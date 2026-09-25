import { asSourceId } from '@domain-forge/core';
import type { FixtureCorpus, FixtureDefinition, GoldFact } from '@domain-forge/contracts';
import { DOMAIN_PACK_SCHEMA_VERSION } from '@hive/pack-contract';

const DEFAULT_FINGERPRINT = 'a'.repeat(64);

export function minimalGoldFact(overrides?: Partial<GoldFact>): GoldFact {
  return {
    id: 'gold-fact-001',
    extractionContractId: 'extract-fact-001',
    factId: 'fact-001',
    expectation: {
      kind: 'present',
      outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
    },
    expectedEvidence: [],
    ...overrides,
  };
}

export function minimalFixtureDefinition(overrides?: Partial<FixtureDefinition>): FixtureDefinition {
  return {
    id: 'fixture-001',
    domainId: 'domain-neutral-test',
    category: 'synthetic',
    tags: ['baseline'],
    sourceBindings: [
      {
        sourceId: asSourceId('src-fixture-001'),
        sourceContentFingerprint: DEFAULT_FINGERPRINT,
        documentTypeId: 'doc-type-001',
        temporalRole: 'current',
      },
    ],
    applicableDocumentTypeIds: ['doc-type-001'],
    packCompatibility: { mode: 'schema_version', schemaVersion: DOMAIN_PACK_SCHEMA_VERSION },
    provenance: { materialClass: 'synthetic', description: 'Test synthetic fixture' },
    goldFacts: [minimalGoldFact()],
    expectedRuleOutcomes: [{ ruleId: 'rule-001', outcome: 'FIRED' }],
    forbiddenExpectations: [],
    ...overrides,
  };
}

export function minimalFixtureCorpus(overrides?: Partial<FixtureCorpus>): FixtureCorpus {
  return {
    corpusId: 'corpus-test-001',
    domainId: 'domain-neutral-test',
    label: 'Neutral test corpus',
    cases: [],
    standaloneFixtures: [minimalFixtureDefinition()],
    ...overrides,
  };
}
