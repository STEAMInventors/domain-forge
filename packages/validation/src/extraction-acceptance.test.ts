import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import { createPackRegistries } from '@domain-forge/core';
import type { ProposedEvidenceReference, ProposedExtraction, SourceRecord } from '@domain-forge/contracts';
import { isAcceptedExtraction } from '@domain-forge/contracts';
import { normalizeQuoteV0 } from '@domain-forge/evidence';
import { createMinimalTestPack } from '@domain-forge/testing';
import { minimalExtractionContract } from '@hive/pack-contract';
import { acceptExtractionProposal } from './extraction-acceptance.js';
import { buildExtractionAcceptanceContext } from './extraction-contract-validation.js';

const sourceText = 'Effective date: January 1, 2024.';
const { normalized: normalizedText } = normalizeQuoteV0(sourceText);

const sourceRecord: SourceRecord = {
  identity: {
    sourceId: asSourceId('src-test-001'),
    sourceType: 'web_snapshot',
    locator: { kind: 'url', url: 'https://example.org/doc' },
    contentFingerprint: {
      algorithm: 'sha256',
      hash: 'd'.repeat(64),
      representation: 'normalized_text',
      normalizationVersion: '0.1.0',
    },
  },
};

function buildContexts(pack = createMinimalTestPack()) {
  const registries = createPackRegistries(pack);
  return {
    extraction: buildExtractionAcceptanceContext(registries),
    evidence: {
      resolveSource: (id: string) => (id === sourceRecord.identity.sourceId ? sourceRecord : undefined),
      getSourceNormalizedText: () => normalizedText,
    },
  };
}

function baseProposal(overrides: Partial<ProposedExtraction> = {}): ProposedExtraction {
  return {
    source: 'MODEL',
    contractId: 'extract-fact-001',
    factId: 'fact-001',
    outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
    documentTypeId: 'doc-type-001',
    evidence: [
      {
        source: 'MODEL',
        sourceId: sourceRecord.identity.sourceId,
        locator: { kind: 'page', page: 1 },
        content: { kind: 'quoted_excerpt', text: 'January 1, 2024' },
      },
    ],
    ...overrides,
  };
}

describe('acceptExtractionProposal', () => {
  it('accepts a valid proposed extraction', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(baseProposal(), contexts.extraction, contexts.evidence);
    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted?.source).toBe('VALIDATED');
    expect(outcome.accepted?.extractionHash).toHaveLength(64);
    expect(outcome.accepted?.evidence[0]?.source).toBe('VALIDATED');
  });

  it('rejects unknown contract id', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({ contractId: 'missing-contract' }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('EXTRACTION_CONTRACT_NOT_FOUND');
  });

  it('rejects wrong value type', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [{ kind: 'value', value: { kind: 'string', value: 'not-a-date' } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_VALUE_TYPE_MISMATCH')).toBe(true);
  });

  it('rejects missing required value for exactly_one cardinality', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({ outcomes: [] }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_CARDINALITY')).toBe(true);
  });

  it('allows zero outcomes for zero_or_more cardinality', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-fact-001', 'fact-001', {
          expectedType: 'string',
          cardinality: 'zero_or_more',
          documentTypeIds: ['doc-type-001'],
          evidence: { required: false, minCount: 0 },
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const outcome = acceptExtractionProposal(
      baseProposal({ outcomes: [], evidence: [] }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(true);
  });

  it('rejects incompatible unit on quantity values', () => {
    const pack = createMinimalTestPack({
      vocabulary: [
        { id: 'term-001', term: 'test-term' },
        { id: 'unit-minutes', term: 'minutes' },
        { id: 'unit-hours', term: 'hours' },
      ],
      extractionContracts: [
        minimalExtractionContract('extract-qty', 'fact-001', {
          expectedType: 'quantity',
          unitId: 'unit-minutes',
          unitRequired: true,
          documentTypeIds: ['doc-type-001'],
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const outcome = acceptExtractionProposal(
      baseProposal({
        contractId: 'extract-qty',
        outcomes: [{ kind: 'value', value: { kind: 'quantity', value: 30, unitId: 'unit-hours' } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_UNIT')).toBe(true);
  });

  it('rejects missing required unit on quantity values', () => {
    const pack = createMinimalTestPack({
      vocabulary: [{ id: 'term-001', term: 'test-term' }, { id: 'unit-minutes', term: 'minutes' }],
      extractionContracts: [
        minimalExtractionContract('extract-qty', 'fact-001', {
          expectedType: 'quantity',
          unitId: 'unit-minutes',
          unitRequired: true,
          documentTypeIds: ['doc-type-001'],
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const outcome = acceptExtractionProposal(
      baseProposal({
        contractId: 'extract-qty',
        outcomes: [{ kind: 'value', value: { kind: 'quantity', value: 30, unitId: '' } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_UNIT')).toBe(true);
  });

  it('rejects unresolved construct vocabulary reference', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({ constructId: 'missing-construct' }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_UNRESOLVED_CONSTRUCT')).toBe(true);
  });

  it('rejects incompatible document type', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({ documentTypeId: 'wrong-doc-type' }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE')).toBe(true);
  });

  it('rejects missing evidence when required', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({ evidence: [] }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_MISSING_EVIDENCE')).toBe(true);
  });

  it('rejects invalid evidence proposals', () => {
    const contexts = buildContexts();
    const badEvidence: ProposedEvidenceReference = {
      source: 'MODEL',
      sourceId: 'missing-source',
      locator: { kind: 'page', page: 1 },
      content: { kind: 'quoted_excerpt', text: 'January 1, 2024' },
    };
    const outcome = acceptExtractionProposal(
      baseProposal({ evidence: [badEvidence] }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_EVIDENCE')).toBe(true);
  });

  it('accepts NOT_PRESENT when escape hatch guidance exists and skips evidence', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [{ kind: 'missingness', state: 'NOT_PRESENT' }],
        evidence: [],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted?.outcomes[0]).toEqual({ kind: 'missingness', state: 'NOT_PRESENT' });
  });

  it('rejects NOT_PRESENT without escape hatch guidance', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-fact-001', 'fact-001', {
          expectedType: 'date',
          documentTypeIds: ['doc-type-001'],
          escapeHatches: undefined,
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [{ kind: 'missingness', state: 'NOT_PRESENT' }],
        evidence: [],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_GUARD_FAILURE')).toBe(true);
  });

  it('preserves evidence provenance on accepted extraction', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(baseProposal(), contexts.extraction, contexts.evidence);
    expect(outcome.accepted?.evidence[0]?.sourceContentFingerprint).toBe(
      sourceRecord.identity.contentFingerprint.hash,
    );
    expect(outcome.accepted?.contractContentHash).toHaveLength(64);
  });

  it('cannot mark raw object as accepted extraction without acceptance boundary', () => {
    expect(
      isAcceptedExtraction({
        source: 'VALIDATED',
        contractId: 'extract-fact-001',
        factId: 'fact-001',
        outcomes: [],
        evidence: [],
        extractionHash: 'a'.repeat(64),
        contractContentHash: 'b'.repeat(64),
      }),
    ).toBe(false);
  });

  it('returns deterministic validation results for repeated calls', () => {
    const contexts = buildContexts();
    const proposal = baseProposal();
    const first = acceptExtractionProposal(proposal, contexts.extraction, contexts.evidence);
    const second = acceptExtractionProposal(proposal, contexts.extraction, contexts.evidence);
    expect(first.result.valid).toBe(true);
    expect(second.result.valid).toBe(true);
    expect(first.accepted?.extractionHash).toBe(second.accepted?.extractionHash);
  });
});
