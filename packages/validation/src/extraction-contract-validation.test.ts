import { describe, it, expect } from 'vitest';
import { createPackRegistries } from '@domain-forge/core';
import { createMinimalTestPack } from '@domain-forge/testing';
import { minimalDomainPack, minimalEntity, minimalExtractionContract } from '@hive/pack-contract';
import {
  validateExtractionContractCompleteness,
  validateExtractionContractReferences,
} from './extraction-contract-validation.js';

describe('validateExtractionContractReferences', () => {
  it('accepts valid contract references', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
    const result = validateExtractionContractReferences(pack, registries);
    expect(result.valid).toBe(true);
  });

  it('rejects dangling fact reference', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-x', 'missing-fact', {
          expectedType: 'string',
        }),
      ],
    });
    const registries = createPackRegistries(pack);
    const result = validateExtractionContractReferences(pack, registries);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EXTRACTION_UNRESOLVED_REFERENCE')).toBe(true);
  });

  it('rejects duplicate contract ids', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('dup-id', 'fact-001'),
        minimalExtractionContract('dup-id', 'fact-001', { expectedType: 'number' }),
      ],
    });
    expect(() => createPackRegistries(pack)).toThrow(/Duplicate id "dup-id"/);
  });

  it('rejects dangling document type reference', () => {
    const pack = createMinimalTestPack({
      extractionContracts: [
        minimalExtractionContract('extract-001', 'fact-001', {
          documentTypeIds: ['missing-doc-type'],
        }),
      ],
    });
    const registries = createPackRegistries(pack);
    const result = validateExtractionContractReferences(pack, registries);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE')).toBe(true);
  });
});

describe('validateExtractionContractCompleteness', () => {
  it('requires extraction guidance for rule-referenced facts', () => {
    const pack = createMinimalTestPack({ extractionContracts: [] });
    const result = validateExtractionContractCompleteness(pack);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('EXTRACTION_CONTRACT_NOT_FOUND');
  });

  it('passes when all rule facts have extraction contracts', () => {
    const pack = createMinimalTestPack();
    const result = validateExtractionContractCompleteness(pack);
    expect(result.valid).toBe(true);
  });

  it('passes for packs with no rules', () => {
    const pack = minimalDomainPack({
      entities: [minimalEntity('entity-001')],
      facts: [{ id: 'fact-001', entityId: 'entity-001' }],
      extractionContracts: [],
      rules: [],
    });
    const result = validateExtractionContractCompleteness(pack);
    expect(result.valid).toBe(true);
  });
});
