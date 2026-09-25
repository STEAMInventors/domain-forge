import { describe, it, expect } from 'vitest';
import {
  composeDomainPack,
  computePackContentHash,
  dependencyRefKey,
  packToDependencyRef,
  PackCompositionError,
  type DomainPackV0,
  type PackResolutionSet,
} from './index.js';
import { minimalDomainPack, minimalEntity, minimalRule } from './test-helpers.js';

function resolutionSet(entries: DomainPackV0[]): PackResolutionSet {
  const map = new Map<string, DomainPackV0>();
  for (const pack of entries) {
    const ref = packToDependencyRef(pack);
    map.set(dependencyRefKey(ref), pack);
  }
  return map;
}

describe('dependencyRefKey', () => {
  it('uses exact immutable identifiers', () => {
    const ref = {
      packId: 'pack-a',
      packVersion: '1.0.0',
      packContentHash: 'a'.repeat(64),
    };
    expect(dependencyRefKey(ref)).toContain('pack-a');
    expect(dependencyRefKey(ref)).toContain('1.0.0');
    expect(dependencyRefKey(ref)).toContain('a'.repeat(64));
  });
});

describe('composeDomainPack', () => {
  it('composes deterministically with extends override semantics', () => {
    const base = minimalDomainPack({
      packId: 'base-pack',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-base')],
      entities: [minimalEntity('entity-base')],
      composition: { strategy: 'snapshot' },
    });
    const baseRef = packToDependencyRef(base);

    const root = minimalDomainPack({
      packId: 'root-pack',
      packVersion: '2.0.0',
      dependencies: { extends: [baseRef], overlay: [], shared: [] },
      rules: [minimalRule('rule-root')],
      composition: { strategy: 'accumulate', archetype: 'ledger' },
    });

    const first = composeDomainPack(root, resolutionSet([base]));
    const second = composeDomainPack(root, resolutionSet([base]));

    expect(first.pack.rules.map((entry) => entry.id).sort()).toEqual(['rule-base', 'rule-root']);
    expect(first.pack.entities).toEqual([minimalEntity('entity-base')]);
    expect(first.pack.composition).toEqual({ strategy: 'accumulate', archetype: 'ledger' });
    expect(first.manifest.layers.map((layer) => layer.role)).toEqual(['extends', 'root']);
    expect(first.packCompositionHash).toBe(second.packCompositionHash);
    expect(computePackContentHash(first.pack)).toBe(computePackContentHash(second.pack));
  });

  it('merges shared dependencies without override conflicts', () => {
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
    const sharedARef = packToDependencyRef(sharedA);
    const sharedBRef = packToDependencyRef(sharedB);

    const root = minimalDomainPack({
      dependencies: { extends: [], overlay: [], shared: [sharedBRef, sharedARef] },
    });

    const result = composeDomainPack(root, resolutionSet([sharedA, sharedB]));
    expect(result.pack.vocabulary.map((entry) => entry.id).sort()).toEqual(['term-a', 'term-b']);
    expect(result.manifest.layers.filter((layer) => layer.role === 'shared')).toHaveLength(2);
  });

  it('applies overlay layers after root content', () => {
    const overlay = minimalDomainPack({
      packId: 'overlay-pack',
      packVersion: '1.0.0',
      rules: [minimalRule('rule-overlay')],
      composition: { strategy: 'accumulate' },
    });
    const overlayRef = packToDependencyRef(overlay);

    const root = minimalDomainPack({
      rules: [minimalRule('rule-root')],
      composition: { strategy: 'snapshot' },
      dependencies: { extends: [], overlay: [overlayRef], shared: [] },
    });

    const result = composeDomainPack(root, resolutionSet([overlay]));
    expect(result.pack.rules.map((entry) => entry.id).sort()).toEqual(['rule-overlay', 'rule-root']);
    expect(result.pack.composition).toEqual({ strategy: 'accumulate' });
    expect(result.manifest.layers.at(-1)?.role).toBe('overlay');
  });

  it('rejects incorrect dependency hash', () => {
    const base = minimalDomainPack({ packId: 'base-pack', packVersion: '1.0.0' });
    const badRef = {
      packId: 'base-pack',
      packVersion: '1.0.0',
      packContentHash: 'f'.repeat(64),
    };
    const root = minimalDomainPack({
      dependencies: { extends: [badRef], overlay: [], shared: [] },
    });

    expect(() => composeDomainPack(root, resolutionSet([base]))).toThrow(PackCompositionError);
    try {
      composeDomainPack(root, resolutionSet([base]));
    } catch (error) {
      expect(error).toBeInstanceOf(PackCompositionError);
      expect((error as PackCompositionError).code).toBe('DEPENDENCY_HASH_MISMATCH');
    }
  });

  it('rejects missing dependency', () => {
    const root = minimalDomainPack({
      dependencies: {
        extends: [
          {
            packId: 'missing-pack',
            packVersion: '1.0.0',
            packContentHash: 'a'.repeat(64),
          },
        ],
        overlay: [],
        shared: [],
      },
    });

    expect(() => composeDomainPack(root, resolutionSet([]))).toThrow(PackCompositionError);
    try {
      composeDomainPack(root, resolutionSet([]));
    } catch (error) {
      expect((error as PackCompositionError).code).toBe('DEPENDENCY_NOT_FOUND');
    }
  });

  it('rejects shared composition conflicts', () => {
    const sharedA = minimalDomainPack({
      packId: 'shared-a',
      packVersion: '1.0.0',
      composition: { strategy: 'snapshot' },
    });
    const sharedB = minimalDomainPack({
      packId: 'shared-b',
      packVersion: '1.0.0',
      composition: { strategy: 'accumulate' },
    });

    const root = minimalDomainPack({
      dependencies: {
        extends: [],
        overlay: [],
        shared: [packToDependencyRef(sharedA), packToDependencyRef(sharedB)],
      },
    });

    expect(() => composeDomainPack(root, resolutionSet([sharedA, sharedB]))).toThrow(
      PackCompositionError,
    );
    try {
      composeDomainPack(root, resolutionSet([sharedA, sharedB]));
    } catch (error) {
      expect((error as PackCompositionError).code).toBe('COMPOSITION_CONFLICT');
    }
  });

  it('rejects circular extends dependencies', () => {
    const packBBase = minimalDomainPack({ packId: 'pack-b', packVersion: '1.0.0' });
    const packCWithCycle = minimalDomainPack({
      packId: 'pack-c',
      packVersion: '1.0.0',
      dependencies: {
        extends: [packToDependencyRef(packBBase)],
        overlay: [],
        shared: [],
      },
    });
    const packB = minimalDomainPack({
      packId: 'pack-b',
      packVersion: '1.0.0',
      dependencies: {
        extends: [packToDependencyRef(packCWithCycle)],
        overlay: [],
        shared: [],
      },
    });

    const root = minimalDomainPack({
      dependencies: { extends: [packToDependencyRef(packB)], overlay: [], shared: [] },
    });

    expect(() => composeDomainPack(root, resolutionSet([packB, packCWithCycle]))).toThrow(
      PackCompositionError,
    );
    try {
      composeDomainPack(root, resolutionSet([packB, packCWithCycle]));
    } catch (error) {
      expect((error as PackCompositionError).code).toBe('COMPOSITION_CYCLE_DETECTED');
    }
  });

  it('repeated composition produces canonical-equivalent results', () => {
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
    const first = composeDomainPack(root, resolution);
    const second = composeDomainPack(root, resolution);

    expect(first.manifest).toEqual(second.manifest);
    expect(first.pack).toEqual(second.pack);
    expect(first.packCompositionHash).toBe(second.packCompositionHash);
  });
});
