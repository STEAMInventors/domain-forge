import { describe, it, expect } from 'vitest';
import { computePackContentHash, DOMAIN_PACK_SCHEMA_VERSION } from './index.js';
import type { DomainPackV0 } from './index.js';

const minimalPack = (): DomainPackV0 => ({
  schemaVersion: DOMAIN_PACK_SCHEMA_VERSION,
  packId: 'p1',
  domainId: 'd1',
  packVersion: '1.0.0',
  scope: 'test',
  jurisdiction: 'TEST',
  corpusHash: 'hash1',
  authorityReferences: [],
  documentTypes: [],
  vocabulary: [],
  entities: [],
  facts: [],
  composition: { strategy: 'snapshot', archetype: 'ledger' },
  timeModels: [],
  identityStrategies: [],
  rules: [],
  questions: [],
  capabilityRequirements: [],
  fixtureReferences: [],
  provenanceReferences: [],
});

describe('pack content hash', () => {
  it('is deterministic', () => {
    const pack = minimalPack();
    const h1 = computePackContentHash(pack);
    const h2 = computePackContentHash(pack);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when content changes', () => {
    const pack1 = minimalPack();
    const pack2 = { ...minimalPack(), scope: 'different' };
    expect(computePackContentHash(pack1)).not.toBe(computePackContentHash(pack2));
  });
});
