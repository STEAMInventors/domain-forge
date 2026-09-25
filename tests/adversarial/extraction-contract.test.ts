import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import { createPackRegistries } from '@domain-forge/core';
import type { ProposedExtraction, SourceRecord } from '@domain-forge/contracts';
import { isAcceptedExtraction } from '@domain-forge/contracts';
import { normalizeQuoteV0 } from '@domain-forge/evidence';
import { createMinimalTestPack } from '@domain-forge/testing';
import { minimalExtractionContract } from '@hive/pack-contract';
import { acceptExtractionProposal } from '@domain-forge/validation';
import { buildExtractionAcceptanceContext } from '@domain-forge/validation';

const sourceText = 'Effective date: January 1, 2024.';
const { normalized: normalizedText } = normalizeQuoteV0(sourceText);

const sourceRecord: SourceRecord = {
  identity: {
    sourceId: asSourceId('src-extract-adv-001'),
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

describe('adversarial: ExtractionContract acceptance', () => {
  it('rejects string masquerading as date value', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [{ kind: 'value', value: { kind: 'string', value: '2024-01-01' } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_VALUE_TYPE_MISMATCH')).toBe(true);
  });

  it('rejects invalid date format', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [{ kind: 'value', value: { kind: 'date', value: 'not-a-valid-date' } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
  });

  it('rejects value plus contradictory missingness in same proposal', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [
          { kind: 'value', value: { kind: 'date', value: '2024-01-01' } },
          { kind: 'missingness', state: 'NOT_PRESENT' },
        ],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_CARDINALITY')).toBe(true);
  });

  it('rejects UNDETERMINED without escape hatch', () => {
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
        outcomes: [{ kind: 'missingness', state: 'UNDETERMINED' }],
        evidence: [],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_GUARD_FAILURE')).toBe(true);
  });

  it('rejects false vs absent confusion for boolean contract', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-bool', 'fact-001', {
          expectedType: 'boolean',
          documentTypeIds: ['doc-type-001'],
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const absentOutcome = acceptExtractionProposal(
      baseProposal({
        contractId: 'extract-bool',
        outcomes: [],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(absentOutcome.result.valid).toBe(false);

    const falseOutcome = acceptExtractionProposal(
      baseProposal({
        contractId: 'extract-bool',
        outcomes: [{ kind: 'value', value: { kind: 'boolean', value: false } }],
        evidence: [],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(falseOutcome.result.valid).toBe(false);
    expect(falseOutcome.result.errors.some((e) => e.code === 'EXTRACTION_MISSING_EVIDENCE')).toBe(true);
  });

  it('rejects zero vs absent for exactly_one number contract', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-num', 'fact-001', {
          expectedType: 'number',
          documentTypeIds: ['doc-type-001'],
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const zeroOutcome = acceptExtractionProposal(
      baseProposal({
        contractId: 'extract-num',
        outcomes: [{ kind: 'value', value: { kind: 'number', value: 0 } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(zeroOutcome.result.valid).toBe(true);
    expect(zeroOutcome.accepted?.outcomes[0]).toEqual({ kind: 'value', value: { kind: 'number', value: 0 } });
  });

  it('rejects too many values for exactly_one cardinality', () => {
    const contexts = buildContexts();
    const outcome = acceptExtractionProposal(
      baseProposal({
        outcomes: [
          { kind: 'value', value: { kind: 'date', value: '2024-01-01' } },
          { kind: 'value', value: { kind: 'date', value: '2024-06-01' } },
        ],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_CARDINALITY')).toBe(true);
  });

  it('rejects raw model extraction shaped like AcceptedExtraction', () => {
    const forged = {
      source: 'VALIDATED',
      contractId: 'extract-fact-001',
      factId: 'fact-001',
      contractEntryId: 'extract-fact-001',
      expectedType: 'date',
      cardinality: 'exactly_one',
      outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
      documentTypeId: 'doc-type-001',
      evidence: [],
      extractionHash: 'a'.repeat(64),
      contractContentHash: 'b'.repeat(64),
    };
    expect(isAcceptedExtraction(forged)).toBe(false);
  });

  it('does not silently coerce number string to number', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-num', 'fact-001', {
          expectedType: 'number',
          documentTypeIds: ['doc-type-001'],
        }),
      ],
    });
    const contexts = buildContexts(pack);
    const outcome = acceptExtractionProposal(
      baseProposal({
        contractId: 'extract-num',
        outcomes: [{ kind: 'value', value: { kind: 'string', value: '42' } }],
      }),
      contexts.extraction,
      contexts.evidence,
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_VALUE_TYPE_MISMATCH')).toBe(true);
  });
});
