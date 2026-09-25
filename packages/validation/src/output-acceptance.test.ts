import { describe, it, expect } from 'vitest';
import { asEvidenceId, asSourceId, hashObject, createPackRegistries } from '@domain-forge/core';
import {
  isAcceptedOutput,
  type AcceptedExtraction,
  type OutputAcceptanceContext,
  type ProposedOutput,
} from '@domain-forge/contracts';
import { ACCEPTED_EXTRACTION_BRAND } from '@domain-forge/contracts';
import { createMinimalTestPack } from '@domain-forge/testing';
import { acceptOutputProposal } from './output-acceptance.js';
import { buildOutputAcceptanceContext } from './output-specification-validation.js';

const EXTRACTION_HASH = 'ext-hash-001';
const RULE_OUTCOME_HASH = 'rule-outcome-hash-001';
const EVIDENCE_HASH = 'evidence-hash-001';

function mockExtraction(): AcceptedExtraction {
  return Object.freeze({
    [ACCEPTED_EXTRACTION_BRAND]: true as const,
    source: 'VALIDATED' as const,
    contractId: 'extract-fact-001',
    factId: 'fact-001',
    contractEntryId: 'extract-fact-001',
    expectedType: 'date',
    cardinality: 'exactly_one',
    outcomes: [{ kind: 'value' as const, value: { kind: 'date' as const, value: '2024-01-01' } }],
    documentTypeId: 'doc-type-001',
    evidence: [],
    extractionHash: EXTRACTION_HASH,
    contractContentHash: 'contract-hash-001',
  });
}

function buildTestContext(pack = createMinimalTestPack()): OutputAcceptanceContext {
  const registries = createPackRegistries(pack);
  const base = buildOutputAcceptanceContext(registries);
  return {
    ...base,
    resolveExtraction: (hash) => (hash === EXTRACTION_HASH ? mockExtraction() : undefined),
    resolveRuleOutcome: (ruleId) =>
      ruleId === 'rule-001'
        ? { ruleId: 'rule-001', outcome: 'FIRED', outcomeHash: RULE_OUTCOME_HASH }
        : undefined,
    resolveEntityInstance: (entityId, instanceId) =>
      entityId === 'entity-001' && instanceId === 'inst-001'
        ? { entityId, instanceId }
        : undefined,
    resolveEvidence: (hash: string) =>
      hash === EVIDENCE_HASH
        ? {
            source: 'VALIDATED' as const,
            evidenceId: asEvidenceId('ev-001'),
            sourceId: asSourceId('src-001'),
            sourceContentFingerprint: 'fp-001',
            locator: { kind: 'page' as const, page: 1 },
            quoteVerified: true,
            evidenceReferenceHash: EVIDENCE_HASH,
          }
        : undefined,
    buildProvenanceForChip: (chip) => {
      if (chip.kind === 'extraction') {
        return [
          {
            targetRef: chip.extractionHash,
            evidenceId: asEvidenceId('ev-001'),
            sourceId: asSourceId('src-001'),
            sourceContentFingerprint: 'fp-001',
          },
        ];
      }
      return [];
    },
  };
}

function validClaimProposal() {
  return {
    source: 'MODEL' as const,
    claimTypeId: 'claim-finding-001',
    claimId: 'claim-001',
    entityId: 'entity-001',
    supportRefs: [
      { kind: 'extraction' as const, extractionHash: EXTRACTION_HASH },
      { kind: 'rule_outcome' as const, ruleId: 'rule-001', outcome: 'FIRED' as const },
      { kind: 'evidence' as const, evidenceReferenceHash: EVIDENCE_HASH },
    ],
  };
}

function validProposedOutput(overrides?: Partial<ProposedOutput>): ProposedOutput {
  return {
    source: 'MODEL',
    specificationId: 'output-spec-professional-001',
    claims: [validClaimProposal()],
    narratives: [
      {
        source: 'MODEL',
        statementId: 'narr-001',
        text: 'The effective date requirement is satisfied.',
        claimRefs: ['claim-001'],
        sectionId: 'section-findings',
      },
    ],
    sections: [
      {
        sectionId: 'section-findings',
        items: [
          {
            itemId: 'finding-001',
            claimRef: 'claim-001',
            ruleOutcomeRef: { ruleId: 'rule-001', outcome: 'FIRED' },
            factId: 'fact-001',
            entityId: 'entity-001',
            evidenceRefs: [EVIDENCE_HASH],
            undetermined: false,
          },
        ],
      },
      {
        sectionId: 'section-entities',
        items: [
          {
            itemId: 'row-001',
            entityInstanceId: 'inst-001',
            entityId: 'entity-001',
            fields: { 'entity-label': { kind: 'string', value: 'Test party' } },
          },
        ],
      },
      {
        sectionId: 'section-timeline',
        items: [
          {
            itemId: 'event-001',
            factId: 'fact-001',
            extractionHash: EXTRACTION_HASH,
            dateValue: '2024-01-01',
            undetermined: false,
          },
        ],
      },
      {
        sectionId: 'section-questions',
        items: [{ itemId: 'q-item-001', questionId: 'q-001' }],
      },
      {
        sectionId: 'section-doc-requests',
        items: [{ itemId: 'doc-req-001', documentTypeId: 'doc-type-001', missingFactId: 'fact-001' }],
      },
      {
        sectionId: 'section-snapshot',
        items: [
          {
            itemId: 'snapshot-001',
            fields: { 'snapshot-date': { kind: 'date', value: '2024-01-01' } },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('acceptOutputProposal', () => {
  it('accepts a fully supported output proposal', () => {
    const outcome = acceptOutputProposal(validProposedOutput(), buildTestContext());
    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted).toBeDefined();
    expect(isAcceptedOutput(outcome.accepted)).toBe(true);
    expect(outcome.accepted?.sections).toHaveLength(6);
  });

  it('rejects unknown specification', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({ specificationId: 'missing-spec' }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors[0]?.code).toBe('OUTPUT_SPECIFICATION_NOT_FOUND');
  });

  it('rejects claim without support chips', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        claims: [
          {
            source: 'MODEL',
            claimTypeId: 'claim-finding-001',
            claimId: 'claim-unsupported',
            supportRefs: [],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_MISSING_CLAIM_SUPPORT')).toBe(true);
  });

  it('rejects narrative without validated claim', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        claims: [],
        narratives: [
          {
            source: 'MODEL',
            statementId: 'narr-free',
            text: 'Unsupported summary text.',
            claimRefs: ['claim-001'],
            sectionId: 'section-findings',
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_INVALID_NARRATIVE_LINKAGE')).toBe(true);
  });

  it('accepts supported narrative with claim linkage', () => {
    const outcome = acceptOutputProposal(validProposedOutput(), buildTestContext());
    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted?.narratives).toHaveLength(1);
    expect(outcome.accepted?.narratives[0]?.claimRefs).toEqual(['claim-001']);
  });

  it('rejects affirmative finding from NOT_FIRED rule outcome', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-findings',
            items: [
              {
                itemId: 'finding-bad',
                claimRef: 'claim-001',
                ruleOutcomeRef: { ruleId: 'rule-001', outcome: 'NOT_FIRED' },
                undetermined: false,
              },
            ],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_RULE_OUTCOME_SEMANTICS')).toBe(true);
  });

  it('preserves missingness vs zero vs unknown field values', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-entities',
            items: [
              {
                itemId: 'row-missing',
                entityInstanceId: 'inst-001',
                entityId: 'entity-001',
                fields: {
                  'entity-label': { kind: 'missingness', state: 'NOT_PRESENT' },
                },
              },
            ],
          },
          {
            sectionId: 'section-snapshot',
            items: [
              {
                itemId: 'snapshot-001',
                fields: {
                  'snapshot-date': { kind: 'number', value: 0 },
                },
              },
            ],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(true);
    const entitySection = outcome.accepted?.sections.find((s) => s.sectionId === 'section-entities');
    const row = entitySection?.items[0] as { fields: Record<string, { kind: string; state?: string }> };
    expect(row.fields['entity-label']?.kind).toBe('missingness');
    expect(row.fields['entity-label']?.state).toBe('NOT_PRESENT');
  });

  it('rejects proposed object masquerading as accepted output', () => {
    const fake = {
      source: 'VALIDATED',
      specificationId: 'output-spec-professional-001',
      sections: [],
      claims: [],
      narratives: [],
      outputHash: hashObject({ fake: true }),
    };
    expect(isAcceptedOutput(fake)).toBe(false);
  });

  it('acceptance is deterministic across repeated calls', () => {
    const context = buildTestContext();
    const proposal = validProposedOutput();
    const first = acceptOutputProposal(proposal, context);
    const second = acceptOutputProposal(proposal, context);
    expect(first.accepted?.outputHash).toBe(second.accepted?.outputHash);
  });

  it('rejects document request without traceable missingFactId when required', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-doc-requests',
            items: [{ itemId: 'doc-req-bad', documentTypeId: 'doc-type-001' }],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_INVALID_DOCUMENT_REQUEST')).toBe(true);
  });

  it('rejects timeline with invented date', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-timeline',
            items: [
              {
                itemId: 'event-bad',
                factId: 'fact-001',
                extractionHash: 'unknown-extraction',
                dateValue: '2024-06-01',
                undetermined: false,
              },
            ],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_INVALID_REFERENCE')).toBe(true);
  });
});
