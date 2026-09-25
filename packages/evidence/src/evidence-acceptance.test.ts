import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import type { ProposedEvidenceReference, SourceRecord } from '@domain-forge/contracts';
import { normalizeQuoteV0 } from './normalize-quote.js';
import {
  acceptProposedEvidenceReference,
  acceptProposedEvidenceReferences,
} from './evidence-acceptance.js';
import { assertEvidenceReferenceImmutable, computeEvidenceReferenceHash } from './evidence-reference-hash.js';
import { buildProvenanceChain, validateProvenanceChain } from './provenance.js';

const sourceText = 'Benefits must be provided within thirty days of application.';
const { normalized: normalizedText } = normalizeQuoteV0(sourceText);

const sourceRecord: SourceRecord = {
  identity: {
    sourceId: asSourceId('src-test-001'),
    sourceType: 'web_snapshot',
    locator: { kind: 'url', url: 'https://example.org/policy' },
    contentFingerprint: {
      algorithm: 'sha256',
      hash: 'c'.repeat(64),
      representation: 'normalized_text',
      normalizationVersion: '0.1.0',
    },
  },
};

function proposal(overrides: Partial<ProposedEvidenceReference> = {}): ProposedEvidenceReference {
  return {
    source: 'MODEL',
    sourceId: sourceRecord.identity.sourceId,
    locator: { kind: 'page', page: 2 },
    ...overrides,
  };
}

describe('acceptProposedEvidenceReference', () => {
  const context = {
    resolveSource: (id: string) => (id === sourceRecord.identity.sourceId ? sourceRecord : undefined),
    getSourceNormalizedText: () => normalizedText,
  };

  it('accepts valid evidence with verified quote', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({
        content: { kind: 'quoted_excerpt', text: 'within thirty days' },
      }),
      context,
    );
    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted?.source).toBe('VALIDATED');
    expect(outcome.accepted?.quoteVerified).toBe(true);
    expect(outcome.accepted?.sourceContentFingerprint).toBe(sourceRecord.identity.contentFingerprint.hash);
  });

  it('rejects missing source', () => {
    const outcome = acceptProposedEvidenceReference(proposal({ sourceId: 'missing' }), context);
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('SOURCE_NOT_FOUND');
  });

  it('rejects evidence without locator precision (invalid page)', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({ locator: { kind: 'page', page: 0 } }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('EVIDENCE_LOCATOR_INVALID');
  });

  it('rejects generated interpretation as quoted evidence', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({
        content: { kind: 'interpretation', text: 'The rule implies a 30-day deadline' },
      }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('EVIDENCE_VERIFICATION_FAILED');
  });

  it('rejects fabricated quote', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({
        content: { kind: 'quoted_excerpt', text: 'fabricated quote text' },
      }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('EVIDENCE_VERIFICATION_FAILED');
  });

  it('does not accept rawCitation alone without validated locator/content', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({ rawCitation: 'See page 2 of the policy manual' }),
      context,
    );
    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted?.quoteVerified).toBe(false);
  });

  it('produces deterministic evidence reference hash', () => {
    const first = acceptProposedEvidenceReference(proposal(), context).accepted!;
    const second = acceptProposedEvidenceReference(proposal(), context).accepted!;
    expect(first.evidenceReferenceHash).toBe(second.evidenceReferenceHash);
    expect(first.evidenceReferenceHash).toBe(
      computeEvidenceReferenceHash({
        sourceId: first.sourceId,
        sourceContentFingerprint: first.sourceContentFingerprint,
        locator: first.locator,
        ...(first.content !== undefined ? { content: first.content } : {}),
      }),
    );
  });

  it('preserves immutable accepted evidence identity', () => {
    const accepted = acceptProposedEvidenceReference(proposal(), context).accepted!;
    const mutated = {
      ...accepted,
      sourceContentFingerprint: 'd'.repeat(64),
    };
    expect(() => assertEvidenceReferenceImmutable(accepted, mutated)).toThrow(/source fingerprint/i);
  });

  it('builds provenance chain to source fingerprint', () => {
    const accepted = acceptProposedEvidenceReference(
      proposal({
        content: { kind: 'quoted_excerpt', text: 'within thirty days' },
      }),
      context,
    ).accepted!;

    const chain = buildProvenanceChain('rule-001.trigger', accepted, sourceRecord);
    expect(chain.sourceId).toBe(sourceRecord.identity.sourceId);
    expect(chain.sourceContentFingerprint).toBe(sourceRecord.identity.contentFingerprint.hash);
    expect(validateProvenanceChain(chain, accepted, sourceRecord).valid).toBe(true);
  });
});

describe('acceptProposedEvidenceReferences', () => {
  it('rejects batch when any proposal is invalid', () => {
    const context = {
      resolveSource: (id: string) => (id === sourceRecord.identity.sourceId ? sourceRecord : undefined),
      getSourceNormalizedText: () => normalizedText,
    };
    const { result } = acceptProposedEvidenceReferences(
      [proposal(), proposal({ sourceId: 'missing' })],
      context,
    );
    expect(result.valid).toBe(false);
  });
});
