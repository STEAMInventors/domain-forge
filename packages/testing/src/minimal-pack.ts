import { DOMAIN_PACK_SCHEMA_VERSION, type DomainPackV0 } from '@hive/pack-contract';

/** Domain-neutral minimal pack for tests */
export function createMinimalTestPack(overrides?: Partial<DomainPackV0>): DomainPackV0 {
  return {
    schemaVersion: DOMAIN_PACK_SCHEMA_VERSION,
    packId: 'pack-test-neutral-001',
    domainId: 'domain-neutral-test',
    packVersion: '0.1.0',
    scope: 'synthetic-test-scope',
    jurisdiction: 'TEST-JURISDICTION',
    corpusHash: 'corpus-hash-test-001',
    authorityReferences: [
      {
        id: 'auth-001',
        sourceSnapshotId: 'snap-test-001',
        quote: 'Synthetic authority quote for testing.',
      },
    ],
    documentTypes: [{ id: 'doc-type-001', name: 'SyntheticDocument', requiredFields: ['fieldA'] }],
    vocabulary: [
      { id: 'term-001', term: 'AlphaMetric', definition: 'A neutral test metric.', authorityRefIds: [] },
    ],
    entities: [{ id: 'entity-001', name: 'SyntheticRecord', grammarType: 'Party', attributes: {} }],
    facts: [
      {
        id: 'fact-001',
        name: 'recordStatus',
        entityId: 'entity-001',
        dataType: 'string',
        authorityRefIds: [],
      },
    ],
    composition: { strategy: 'snapshot', archetype: 'ledger' },
    timeModels: [{ id: 'tm-001', model: 'calendar_day', parameters: {} }],
    identityStrategies: [{ entityId: 'entity-001', strategy: 'external_id', parameters: {} }],
    rules: [
      {
        id: 'rule-001',
        name: 'RequireStatus',
        trigger: 'on_evaluate',
        primitive: 'REQUIRE',
        entityIds: ['entity-001'],
        factIds: ['fact-001'],
        exceptions: [],
        authorityRefIds: ['auth-001'],
      },
    ],
    questions: [{ id: 'q-001', ruleId: 'rule-001', text: 'Is the record status present?', requiredFacts: ['fact-001'] }],
    capabilityRequirements: [],
    fixtureReferences: [{ id: 'fix-ref-001', ruleId: 'rule-001', fixtureType: 'FIRE' }],
    provenanceReferences: [{ id: 'prov-001', type: 'forge-run', ref: 'run-test-001' }],
    ...overrides,
  };
}
