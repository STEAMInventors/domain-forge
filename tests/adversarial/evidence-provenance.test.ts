import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import type { ProposedEvidenceReference, SourceRecord } from '@domain-forge/contracts';
import { normalizeQuoteV0 } from '@domain-forge/evidence';
import {
  acceptProposedEvidenceReference,
  buildProvenanceChain,
  validateProvenanceChain,
} from '@domain-forge/evidence';
import { validateEvidenceLocator } from '@domain-forge/evidence';

const sourceText = 'Coverage begins on January 1, 2024 for eligible members.';
const { normalized: normalizedText } = normalizeQuoteV0(sourceText);

const sourceRecord: SourceRecord = {
  identity: {
    sourceId: asSourceId('src-adversarial-001'),
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
    locator: { kind: 'page', page: 1 },
    ...overrides,
  };
}

describe('adversarial: evidence and provenance', () => {
  const context = {
    resolveSource: (id: string) => (id === sourceRecord.identity.sourceId ? sourceRecord : undefined),
    getSourceNormalizedText: () => normalizedText,
  };

  it('rejects nonexistent source', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({ sourceId: asSourceId('missing-source') }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('SOURCE_NOT_FOUND');
  });

  it('rejects wrong source fingerprint in provenance chain', () => {
    const accepted = acceptProposedEvidenceReference(
      proposal({ content: { kind: 'quoted_excerpt', text: 'January 1, 2024' } }),
      context,
    );
    expect(accepted.accepted).toBeDefined();

    const badChain = buildProvenanceChain('target-ref', accepted.accepted!, sourceRecord);
    const tamperedChain = { ...badChain, sourceContentFingerprint: 'f'.repeat(64) };
    const validation = validateProvenanceChain(tamperedChain, accepted.accepted!, sourceRecord);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'EVIDENCE_REFERENCE_INVALID')).toBe(true);
  });

  it('rejects fabricated quote against valid source', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({ content: { kind: 'quoted_excerpt', text: 'completely fabricated language' } }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EVIDENCE_VERIFICATION_FAILED')).toBe(true);
  });

  it('rejects interpretation presented as quote', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({
        content: { kind: 'interpretation', text: 'The policy implies coverage for all members' },
      }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EVIDENCE_VERIFICATION_FAILED')).toBe(true);
  });

  it('rejects invalid page span (page zero)', () => {
    const outcome = acceptProposedEvidenceReference(
      proposal({ locator: { kind: 'page', page: 0 } }),
      context,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EVIDENCE_LOCATOR_INVALID')).toBe(true);
  });

  it('rejects inverted character span ranges', () => {
    const locatorResult = validateEvidenceLocator({
      kind: 'character_span',
      startOffset: 100,
      endOffset: 10,
    });
    expect(locatorResult.valid).toBe(false);
  });

  it('rejects ambiguous locator with empty field path', () => {
    const locatorResult = validateEvidenceLocator({
      kind: 'field_path',
      path: '',
    });
    expect(locatorResult.valid).toBe(false);
  });

  it('detects source content change after evidence creation via fingerprint mismatch', () => {
    const accepted = acceptProposedEvidenceReference(
      proposal({ content: { kind: 'quoted_excerpt', text: 'January 1, 2024' } }),
      context,
    );
    expect(accepted.accepted?.sourceContentFingerprint).toBe(
      sourceRecord.identity.contentFingerprint.hash,
    );

    const mutatedSource: SourceRecord = {
      ...sourceRecord,
      identity: {
        ...sourceRecord.identity,
        contentFingerprint: {
          ...sourceRecord.identity.contentFingerprint,
          hash: 'd'.repeat(64),
        },
      },
    };

    const chain = buildProvenanceChain('target', accepted.accepted!, mutatedSource);
    const validation = validateProvenanceChain(chain, accepted.accepted!, mutatedSource);
    expect(validation.valid).toBe(false);
  });

  it('rejects provenance chain pointing to wrong source id', () => {
    const accepted = acceptProposedEvidenceReference(
      proposal({ content: { kind: 'quoted_excerpt', text: 'January 1, 2024' } }),
      context,
    );
    const chain = buildProvenanceChain('target', accepted.accepted!, sourceRecord);
    const wrongSourceChain = { ...chain, sourceId: asSourceId('wrong-source') };
    const validation = validateProvenanceChain(wrongSourceChain, accepted.accepted!, sourceRecord);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'EVIDENCE_REFERENCE_INVALID')).toBe(true);
  });

  it('rejects evidence reference reused against different source version fingerprint', () => {
    const accepted = acceptProposedEvidenceReference(
      proposal({ content: { kind: 'quoted_excerpt', text: 'January 1, 2024' } }),
      context,
    );
    const otherSource: SourceRecord = {
      identity: {
        sourceId: asSourceId('src-other-version'),
        sourceType: 'web_snapshot',
        locator: { kind: 'url', url: 'https://example.org/policy-v2' },
        contentFingerprint: {
          algorithm: 'sha256',
          hash: 'e'.repeat(64),
          representation: 'normalized_text',
          normalizationVersion: '0.1.0',
        },
        version: '2.0.0',
      },
    };

    const chain = buildProvenanceChain('target', accepted.accepted!, otherSource);
    const validation = validateProvenanceChain(chain, accepted.accepted!, otherSource);
    expect(validation.valid).toBe(false);
  });
});
