import { describe, it, expect } from 'vitest';
import {
  computePackContentHash,
  composeDomainPack,
  dependencyRefKey,
  packToDependencyRef,
  ExtractionContractEntrySchema,
  parseDomainPackV0,
} from './index.js';
import { minimalDomainPack, minimalExtractionContract, minimalEntity, minimalRule } from './test-helpers.js';

describe('ExtractionContractEntrySchema', () => {
  it('accepts a valid extraction contract entry', () => {
    const result = ExtractionContractEntrySchema.safeParse(
      minimalExtractionContract('extract-001', 'fact-001', {
        expectedType: 'date',
        documentTypeIds: [],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects enum type without enumValues', () => {
    const result = ExtractionContractEntrySchema.safeParse(
      minimalExtractionContract('extract-001', 'fact-001', {
        expectedType: 'enum',
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects reference type without referenceRegistry', () => {
    const result = ExtractionContractEntrySchema.safeParse(
      minimalExtractionContract('extract-001', 'fact-001', {
        expectedType: 'reference',
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects unitRequired quantity without unitId', () => {
    const result = ExtractionContractEntrySchema.safeParse(
      minimalExtractionContract('extract-001', 'fact-001', {
        expectedType: 'quantity',
        unitRequired: true,
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe('DomainPackV0 extractionContracts integration', () => {
  it('includes extractionContracts in pack content hashing', () => {
    const without = parseDomainPackV0(minimalDomainPack());
    const withContract = parseDomainPackV0(
      minimalDomainPack({
        facts: [{ id: 'fact-001', entityId: 'entity-001' }],
        entities: [minimalEntity('entity-001')],
        extractionContracts: [minimalExtractionContract('extract-001', 'fact-001')],
      }),
    );
    expect(computePackContentHash(without)).not.toBe(computePackContentHash(withContract));
  });

  it('composes extractionContracts with override semantics', () => {
    const base = minimalDomainPack({
      packId: 'base-pack',
      packVersion: '1.0.0',
      facts: [{ id: 'fact-001', entityId: 'entity-001' }],
      entities: [minimalEntity('entity-001')],
      extractionContracts: [
        minimalExtractionContract('extract-001', 'fact-001', { definition: 'Base definition' }),
      ],
    });
    const baseRef = packToDependencyRef(base);
    const root = minimalDomainPack({
      packId: 'root-pack',
      packVersion: '2.0.0',
      dependencies: { extends: [baseRef], overlay: [], shared: [] },
      facts: [{ id: 'fact-001', entityId: 'entity-001' }],
      entities: [minimalEntity('entity-001')],
      rules: [minimalRule('rule-001', { factIds: ['fact-001'] })],
      extractionContracts: [
        minimalExtractionContract('extract-001', 'fact-001', { definition: 'Root override definition' }),
      ],
    });

    const resolutionSet = new Map([[dependencyRefKey(baseRef), base]]);
    const composed = composeDomainPack(root, resolutionSet);
    expect(composed.pack.extractionContracts).toHaveLength(1);
    expect(composed.pack.extractionContracts[0]?.definition).toBe('Root override definition');
  });
});
