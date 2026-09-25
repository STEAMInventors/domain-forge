import { describe, it, expect } from 'vitest';
import { createPackRegistries } from '@domain-forge/core';
import { minimalDomainPack, minimalOutputSpecification } from '@hive/pack-contract';
import {
  validateOutputSpecificationCompleteness,
  validateOutputSpecificationReferences,
} from './output-specification-validation.js';

describe('validateOutputSpecificationReferences', () => {
  it('accepts valid references', () => {
    const pack = minimalDomainPack({
      entities: [{ id: 'entity-001', grammarType: 'Party' }],
      facts: [{ id: 'fact-001', entityId: 'entity-001' }],
      rules: [{ id: 'rule-001', primitive: 'REQUIRE', factIds: ['fact-001'], entityIds: [], authorityRefIds: [] }],
      questions: [{ id: 'q-001', text: 'What is the status?' }],
      documentTypes: [{ id: 'doc-type-001' }],
      timeModels: [{ id: 'tm-001', model: 'calendar_day' }],
      outputSpecifications: [minimalOutputSpecification('output-spec-valid')],
    });
    const registries = createPackRegistries(pack);
    const result = validateOutputSpecificationReferences(pack, registries);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate specification id', () => {
    const spec = minimalOutputSpecification('dup-spec');
    const pack = minimalDomainPack({
      outputSpecifications: [spec, spec],
    });
    expect(() => createPackRegistries(pack)).toThrow(/Duplicate id "dup-spec"/);
  });

  it('rejects unknown section type', () => {
    const spec = minimalOutputSpecification('output-spec-bad-type');
    spec.sections[0]!.sectionType = 'CUSTOM_WIDGET';
    const pack = minimalDomainPack({ outputSpecifications: [spec] });
    const result = validateOutputSpecificationReferences(pack, createPackRegistries(pack));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'OUTPUT_UNSUPPORTED_SECTION_TYPE')).toBe(true);
  });

  it('rejects dangling fact reference', () => {
    const spec = minimalOutputSpecification('output-spec-dangling-fact');
    spec.sections[0]!.sourceFactIds = ['missing-fact'];
    const pack = minimalDomainPack({ outputSpecifications: [spec] });
    const result = validateOutputSpecificationReferences(pack, createPackRegistries(pack));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'OUTPUT_INVALID_REFERENCE')).toBe(true);
  });
});

describe('validateOutputSpecificationCompleteness', () => {
  it('passes when output facts have extraction contracts', () => {
    const pack = minimalDomainPack({
      entities: [{ id: 'entity-001', grammarType: 'Party' }],
      facts: [{ id: 'fact-001', entityId: 'entity-001' }],
      extractionContracts: [
        {
          id: 'extract-001',
          factId: 'fact-001',
          definition: 'Test fact definition',
          expectedType: 'date',
          cardinality: 'exactly_one',
          evidence: { required: true, minCount: 1 },
          positiveExamples: [],
          negativeExamples: [],
          documentTypeIds: [],
          vocabularyRefs: [],
          identityHints: [],
          phrasingConstraints: [],
          unitRequired: false,
        },
      ],
      outputSpecifications: [minimalOutputSpecification('output-spec-complete')],
    });
    const result = validateOutputSpecificationCompleteness(pack);
    expect(result.valid).toBe(true);
  });

  it('fails when output fact lacks extraction contract', () => {
    const pack = minimalDomainPack({
      entities: [{ id: 'entity-001', grammarType: 'Party' }],
      facts: [{ id: 'fact-001', entityId: 'entity-001' }],
      extractionContracts: [],
      outputSpecifications: [minimalOutputSpecification('output-spec-incomplete')],
    });
    const result = validateOutputSpecificationCompleteness(pack);
    expect(result.valid).toBe(false);
  });
});
