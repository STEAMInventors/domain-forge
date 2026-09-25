import {
  DOMAIN_PACK_SCHEMA_VERSION,
  minimalOutputSpecification,
  type DomainPackV0,
} from '@hive/pack-contract';

/** Domain-neutral minimal pack shell with Step-10 registry section fields for tests. */
export function createMinimalTestPack(overrides?: Partial<DomainPackV0>): DomainPackV0 {
  return {
    schemaVersion: DOMAIN_PACK_SCHEMA_VERSION,
    packId: 'pack-test-neutral-001',
    domainId: 'domain-neutral-test',
    packVersion: '0.1.0',
    scope: 'synthetic-test-scope',
    jurisdiction: 'TEST-JURISDICTION',
    dependencies: { extends: [], overlay: [], shared: [] },
    corpusHash: 'corpus-hash-test-001',
    authorityReferences: [{ id: 'auth-001', label: 'Test authority' }],
    documentTypes: [{ id: 'doc-type-001', label: 'Test document type' }],
    vocabulary: [{ id: 'term-001', term: 'test-term' }],
    entities: [{ id: 'entity-001', grammarType: 'Party', label: 'Test party' }],
    facts: [{ id: 'fact-001', entityId: 'entity-001', label: 'Test fact' }],
    extractionContracts: [
      {
        id: 'extract-fact-001',
        factId: 'fact-001',
        definition: 'The effective date stated on the document.',
        expectedType: 'date',
        cardinality: 'exactly_one',
        evidence: { required: true, minCount: 1 },
        positiveExamples: ['Effective date: January 1, 2024'],
        negativeExamples: ['Submission date only'],
        documentTypeIds: ['doc-type-001'],
        vocabularyRefs: [],
        identityHints: [],
        phrasingConstraints: [],
        unitRequired: false,
        escapeHatches: {
          notPresent: 'No effective date appears anywhere in the document.',
          undetermined: 'Multiple conflicting effective dates appear without resolution.',
          reviewRequired: [],
        },
      },
    ],
    composition: { strategy: 'snapshot', archetype: 'ledger' },
    timeModels: [{ id: 'tm-001', model: 'calendar_day' }],
    identityStrategies: [{ id: 'is-001', strategy: 'external_id' }],
    rules: [
      {
        id: 'rule-001',
        primitive: 'REQUIRE',
        entityIds: ['entity-001'],
        factIds: ['fact-001'],
        authorityRefIds: ['auth-001'],
      },
    ],
    questions: [{ id: 'q-001', text: 'What is the current status?' }],
    outputSpecifications: [minimalOutputSpecification('output-spec-professional-001')],
    capabilityRequirements: [],
    fixtureReferences: [
      {
        id: 'fix-ref-001',
        corpusId: 'corpus-test-001',
        fixtureIds: ['fixture-001'],
      },
    ],
    provenanceReferences: [{ id: 'prov-001' }],
    ...overrides,
  };
}
