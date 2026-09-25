import { describe, it, expect } from 'vitest';
import { asEvidenceId, asSourceId, createPackRegistries } from '@domain-forge/core';
import {
  isAcceptedOutput,
  type AcceptedExtraction,
  type OutputAcceptanceContext,
  type ProposedOutput,
} from '@domain-forge/contracts';
import { ACCEPTED_EXTRACTION_BRAND } from '@domain-forge/contracts';
import { createMinimalTestPack } from '@domain-forge/testing';
import { acceptOutputProposal } from '@domain-forge/validation';
import { buildOutputAcceptanceContext } from '@domain-forge/validation';

const EXTRACTION_HASH = 'ext-hash-adv-001';
const RULE_OUTCOME_HASH = 'rule-outcome-hash-adv-001';
const EVIDENCE_HASH = 'evidence-hash-adv-001';

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
    contractContentHash: 'contract-hash-adv-001',
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
            evidenceId: asEvidenceId('ev-adv-001'),
            sourceId: asSourceId('src-adv-001'),
            sourceContentFingerprint: 'fp-adv-001',
            locator: { kind: 'page' as const, page: 1 },
            quoteVerified: true,
            evidenceReferenceHash: EVIDENCE_HASH,
          }
        : undefined,
    buildProvenanceForChip: () => [],
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
    ],
    ...overrides,
  };
}

describe('adversarial: OutputSpecification — no chip, no claim', () => {
  it('rejects claim without any support chips', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        claims: [
          {
            source: 'MODEL',
            claimTypeId: 'claim-finding-001',
            claimId: 'claim-empty',
            supportRefs: [],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_MISSING_CLAIM_SUPPORT')).toBe(true);
  });

  it('rejects claim with wrong chip type (unknown extraction hash)', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        claims: [
          {
            source: 'MODEL',
            claimTypeId: 'claim-finding-001',
            claimId: 'claim-bad-chip',
            supportRefs: [{ kind: 'extraction', extractionHash: 'nonexistent-hash' }],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_MISSING_CLAIM_SUPPORT')).toBe(true);
  });

  it('rejects narrative with no underlying validated claim', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        claims: [],
        narratives: [
          {
            source: 'MODEL',
            statementId: 'narr-orphan',
            text: 'Free-form authoritative narrative without claim.',
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

  it('rejects narrative referencing missing claim id', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        narratives: [
          {
            source: 'MODEL',
            statementId: 'narr-missing-ref',
            text: 'Statement with dangling claim ref.',
            claimRefs: ['claim-does-not-exist'],
            sectionId: 'section-findings',
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_INVALID_NARRATIVE_LINKAGE')).toBe(true);
  });

  it('rejects affirmative finding from UNDETERMINED when not permitted', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-findings',
            items: [
              {
                itemId: 'finding-undetermined',
                claimRef: 'claim-001',
                ruleOutcomeRef: { ruleId: 'rule-001', outcome: 'FIRED' },
                undetermined: false,
              },
            ],
          },
        ],
        claims: [
          {
            source: 'MODEL',
            claimTypeId: 'claim-finding-001',
            claimId: 'claim-001',
            supportRefs: [{ kind: 'extraction', extractionHash: EXTRACTION_HASH }],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
  });

  it('rejects arbitrary undeclared question in output sections', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-questions',
            items: [{ itemId: 'q-bad', questionId: 'invented-question-id' }],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_INVALID_QUESTION_REFERENCE')).toBe(true);
  });

  it('rejects CASE_SNAPSHOT with undeclared field id', () => {
    const outcome = acceptOutputProposal(
      validProposedOutput({
        sections: [
          {
            sectionId: 'section-snapshot',
            items: [
              {
                itemId: 'snapshot-bad',
                fields: { 'invented-field-id': { kind: 'string', value: 'forged' } },
              },
            ],
          },
        ],
      }),
      buildTestContext(),
    );
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.some((e) => e.code === 'OUTPUT_INVALID_SECTION_FIELD')).toBe(true);
  });

  it('rejects raw model output masquerading as AcceptedOutput', () => {
    const forged = {
      source: 'VALIDATED',
      specificationId: 'output-spec-professional-001',
      sections: [],
      claims: [],
      narratives: [],
      outputHash: 'a'.repeat(64),
    };
    expect(isAcceptedOutput(forged)).toBe(false);
  });

  it('does not flatten missingness into absent field omission', () => {
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
});
