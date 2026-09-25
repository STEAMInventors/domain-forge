import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createPackRegistries } from '@domain-forge/core';
import { composeDomainPack, computePackContentHash, minimalOutputSpecification } from '@hive/pack-contract';
import { isAcceptedOutput } from '@domain-forge/contracts';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  buildOutputAcceptanceContext,
  validateOutputSpecificationReferences,
} from '@domain-forge/validation';

const ROOT = join(import.meta.dirname, '../..');
const PACK_CONTRACT = join(ROOT, 'packages/pack-contract/src');

describe('architecture: output specification', () => {
  it('@hive/pack-contract output schemas do not import Forge packages', () => {
    const file = join(PACK_CONTRACT, 'output-specification-v0.ts');
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/@domain-forge\//);
  });

  it('output acceptance uses pack registries without domain-specific constants', () => {
    const forbidden = ['IEP', 'Medicaid', 'BIP'];
    const file = join(ROOT, 'packages/validation/src/output-acceptance.ts');
    const content = readFileSync(file, 'utf8');
    for (const term of forbidden) {
      expect(content).not.toContain(term);
    }
  });

  it('resolves output specifications from composed pack registries only', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
    registries.validateCrossReferences();
    const context = buildOutputAcceptanceContext(registries);
    expect(context.resolveSpecification('output-spec-professional-001')?.audience).toBe('professional');
  });

  it('participates in composition merge and hashing', () => {
    const base = createMinimalTestPack({
      packId: 'pack-base-output',
      outputSpecifications: [minimalOutputSpecification('base-output-spec')],
    });
    const overlay = createMinimalTestPack({
      packId: 'pack-overlay-output',
      outputSpecifications: [minimalOutputSpecification('overlay-output-spec')],
    });
    const baseHash = computePackContentHash(base);
    const resolutionSet = new Map([[`${base.packId}\u0000${base.packVersion}\u0000${baseHash}`, base]]);
    const root = createMinimalTestPack({
      packId: 'pack-root-output',
      dependencies: {
        extends: [],
        overlay: [{ packId: overlay.packId, packVersion: overlay.packVersion, packContentHash: computePackContentHash(overlay) }],
        shared: [],
      },
      outputSpecifications: [minimalOutputSpecification('root-output-spec')],
    });
    resolutionSet.set(
      `${overlay.packId}\u0000${overlay.packVersion}\u0000${computePackContentHash(overlay)}`,
      overlay,
    );
    const composed = composeDomainPack(root, resolutionSet);
    expect(composed.pack.outputSpecifications.map((s) => s.id)).toContain('root-output-spec');
    expect(composed.pack.outputSpecifications.map((s) => s.id)).toContain('overlay-output-spec');
  });

  it('raw model-shaped objects are not accepted outputs', () => {
    const fakeAccepted = {
      source: 'VALIDATED',
      specificationId: 'output-spec-professional-001',
      sections: [],
      claims: [],
      narratives: [],
      outputHash: 'a'.repeat(64),
    };
    expect(isAcceptedOutput(fakeAccepted)).toBe(false);
    const pack = createMinimalTestPack();
    const result = validateOutputSpecificationReferences(pack, createPackRegistries(pack));
    expect(result.valid).toBe(true);
  });
});
