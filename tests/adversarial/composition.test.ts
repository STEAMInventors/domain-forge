import { describe, it, expect } from 'vitest';
import {
  composeDomainPack,
  computePackContentHash,
  computePackCompositionHash,
  dependencyRefKey,
  packToDependencyRef,
  PackCompositionError,
  minimalDomainPack,
  minimalRule,
  minimalEntity,
  type DomainPackV0,
  type PackResolutionSet,
} from '@hive/pack-contract';
import { expectCompositionError } from './helpers.js';

function resolutionSet(entries: DomainPackV0[]): PackResolutionSet {
  const map = new Map<string, DomainPackV0>();
  for (const pack of entries) {
    map.set(dependencyRefKey(packToDependencyRef(pack)), pack);
  }
  return map;
}

describe('adversarial: composition', () => {
  it('rejects deep dependency cycles (A extends B extends C extends A)', () => {
    const packA = minimalDomainPack({ packId: 'pack-a', packVersion: '1.0.0' });
    const packC = minimalDomainPack({
      packId: 'pack-c',
      packVersion: '1.0.0',
      dependencies: { extends: [packToDependencyRef(packA)], overlay: [], shared: [] },
    });
    const packB = minimalDomainPack({
      packId: 'pack-b',
      packVersion: '1.0.0',
      dependencies: { extends: [packToDependencyRef(packC)], overlay: [], shared: [] },
    });
    const packAWithCycle = minimalDomainPack({
      packId: 'pack-a',
      packVersion: '1.0.0',
      dependencies: { extends: [packToDependencyRef(packB)], overlay: [], shared: [] },
    });

    const root = minimalDomainPack({
      dependencies: { extends: [packToDependencyRef(packAWithCycle)], overlay: [], shared: [] },
    });

    expectCompositionError(
      () => composeDomainPack(root, resolutionSet([packAWithCycle, packB, packC])),
      'COMPOSITION_CYCLE_DETECTED',
    );
  });

  it('rejects duplicate shared dependency identity with conflicting entries', () => {
    const shared = minimalDomainPack({
      packId: 'shared-a',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-conflict', { primitive: 'REQUIRE' })],
    });
    const conflicting = minimalDomainPack({
      packId: 'shared-b',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-conflict', { primitive: 'FORBID' })],
    });

    const root = minimalDomainPack({
      dependencies: {
        extends: [],
        overlay: [],
        shared: [packToDependencyRef(shared), packToDependencyRef(conflicting)],
      },
    });

    expectCompositionError(
      () => composeDomainPack(root, resolutionSet([shared, conflicting])),
      'COMPOSITION_CONFLICT',
    );
  });

  it('rejects conflicting extends layers for same rule id', () => {
    const base = minimalDomainPack({
      packId: 'base-pack',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-shared-id', { primitive: 'REQUIRE' })],
    });
    const child = minimalDomainPack({
      packId: 'child-pack',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-shared-id', { primitive: 'FORBID' })],
      dependencies: { extends: [packToDependencyRef(base)], overlay: [], shared: [] },
    });

    const root = minimalDomainPack({
      dependencies: { extends: [packToDependencyRef(child)], overlay: [], shared: [] },
    });

    const result = composeDomainPack(root, resolutionSet([base, child]));
    expect(result.pack.rules.find((r) => r.id === 'rule-shared-id')?.primitive).toBe('FORBID');
  });

  it('applies overlay precedence after root content', () => {
    const overlay = minimalDomainPack({
      packId: 'overlay-pack',
      packVersion: '1.0.0',
      entities: [minimalEntity('entity-overlay')],
    });
    const root = minimalDomainPack({
      entities: [minimalEntity('entity-root')],
      dependencies: { extends: [], overlay: [packToDependencyRef(overlay)], shared: [] },
    });

    const result = composeDomainPack(root, resolutionSet([overlay]));
    expect(result.pack.entities.map((e) => e.id)).toContain('entity-overlay');
    expect(result.manifest.layers.at(-1)?.role).toBe('overlay');
  });

  it('produces identical results when shared dependency declaration order is identical', () => {
    const sharedA = minimalDomainPack({
      packId: 'shared-a',
      packVersion: '1.0.0',
      vocabulary: [{ id: 'term-a' }],
    });
    const sharedB = minimalDomainPack({
      packId: 'shared-b',
      packVersion: '1.0.0',
      vocabulary: [{ id: 'term-b' }],
    });

    const root = minimalDomainPack({
      dependencies: {
        extends: [],
        overlay: [],
        shared: [packToDependencyRef(sharedA), packToDependencyRef(sharedB)],
      },
    });

    const first = composeDomainPack(root, resolutionSet([sharedA, sharedB]));
    const second = composeDomainPack(root, resolutionSet([sharedA, sharedB]));

    expect(first.packCompositionHash).toBe(second.packCompositionHash);
    expect(computePackContentHash(first.pack)).toBe(computePackContentHash(second.pack));
  });

  it('rejects mutated dependency under same declared hash', () => {
    const base = minimalDomainPack({ packId: 'base-pack', packVersion: '1.0.0' });
    const declaredHash = computePackContentHash(base);
    const tampered = minimalDomainPack({
      packId: 'base-pack',
      packVersion: '1.0.0',
      rules: [minimalRule('tampered-rule')],
    });

    const badRef = {
      packId: 'base-pack',
      packVersion: '1.0.0',
      packContentHash: declaredHash,
    };
    const root = minimalDomainPack({
      dependencies: { extends: [badRef], overlay: [], shared: [] },
    });

    expect(() => composeDomainPack(root, resolutionSet([tampered]))).toThrow(PackCompositionError);
    try {
      composeDomainPack(root, resolutionSet([tampered]));
    } catch (error) {
      expect((error as PackCompositionError).code).toBe('DEPENDENCY_HASH_MISMATCH');
    }
  });

  it('rejects dependency identity mismatch (packId/version vs resolved content)', () => {
    const actual = minimalDomainPack({ packId: 'real-pack', packVersion: '1.0.0' });
    const wrongRef = {
      packId: 'wrong-pack-id',
      packVersion: '1.0.0',
      packContentHash: computePackContentHash(actual),
    };
    const root = minimalDomainPack({
      dependencies: { extends: [wrongRef], overlay: [], shared: [] },
    });
    const maliciousResolution = new Map([[dependencyRefKey(wrongRef), actual]]);

    expectCompositionError(
      () => composeDomainPack(root, maliciousResolution),
      'DEPENDENCY_IDENTITY_MISMATCH',
    );
  });

  it('rejects malformed dependency references at pack parse boundary', () => {
    const root = minimalDomainPack();
    expect(() =>
      composeDomainPack(
        {
          ...root,
          dependencies: {
            extends: [{ packId: '', packVersion: '1.0.0', packContentHash: 'a'.repeat(64) }],
            overlay: [],
            shared: [],
          },
        },
        resolutionSet([]),
      ),
    ).toThrow();
  });

  it('repeated composition of identical inputs produces identical composition hash', () => {
    const shared = minimalDomainPack({
      packId: 'shared-lib',
      packVersion: '1.0.0',
      facts: [{ id: 'fact-shared', entityId: 'entity-shared' }],
      entities: [minimalEntity('entity-shared')],
    });
    const base = minimalDomainPack({
      packId: 'base-pack',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-base')],
    });
    const root = minimalDomainPack({
      dependencies: {
        extends: [packToDependencyRef(base)],
        overlay: [],
        shared: [packToDependencyRef(shared)],
      },
      rules: [minimalRule('rule-root')],
    });

    const resolution = resolutionSet([shared, base]);
    const runs = Array.from({ length: 5 }, () => composeDomainPack(root, resolution));
    const hashes = runs.map((r) => r.packCompositionHash);
    expect(new Set(hashes).size).toBe(1);
    expect(new Set(runs.map((r) => computePackCompositionHash(r.manifest))).size).toBe(1);
  });

  it('treats overlay vs shared type confusion as composition conflict when content diverges', () => {
    const overlayPack = minimalDomainPack({
      packId: 'overlay-pack',
      packVersion: '1.0.0',
      composition: { strategy: 'accumulate' },
    });
    const sharedPack = minimalDomainPack({
      packId: 'shared-pack',
      packVersion: '1.0.0',
      composition: { strategy: 'snapshot' },
    });

    const root = minimalDomainPack({
      composition: { strategy: 'snapshot' },
      dependencies: {
        extends: [],
        overlay: [],
        shared: [packToDependencyRef(overlayPack), packToDependencyRef(sharedPack)],
      },
    });

    expectCompositionError(
      () => composeDomainPack(root, resolutionSet([overlayPack, sharedPack])),
      'COMPOSITION_CONFLICT',
    );
  });
});
