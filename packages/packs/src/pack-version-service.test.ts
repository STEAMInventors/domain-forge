import { describe, it, expect } from 'vitest';
import { computePackContentHash } from '@hive/pack-contract';
import { LifecycleTransitionError } from '@domain-forge/core';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  applyPackVersionTransition,
  createPackVersion,
  createPackVersionFromContentChange,
} from './pack-version-service.js';

describe('pack-version lifecycle service', () => {
  it('creates pack versions in DRAFT with stable content hash', () => {
    const pack = createMinimalTestPack();
    const version = createPackVersion('pack-001', '0.1.0', pack);
    expect(version.state).toBe('DRAFT');
    expect(version.packContentHash).toBe(computePackContentHash(pack));
  });

  it('applies lifecycle transitions without mutating pack content', () => {
    const pack = createMinimalTestPack();
    const original = createPackVersion('pack-001', '0.1.0', pack);
    const { packVersion, record } = applyPackVersionTransition(
      original,
      'PROMOTE_TO_PROVISIONAL',
    );

    expect(packVersion.state).toBe('PROVISIONAL');
    expect(packVersion.packContent).toEqual(original.packContent);
    expect(packVersion.packContentHash).toBe(original.packContentHash);
    expect(record.fromState).toBe('DRAFT');
    expect(record.toState).toBe('PROVISIONAL');
    expect(record.action).toBe('PROMOTE_TO_PROVISIONAL');
    expect(record.packContentHash).toBe(original.packContentHash);
    expect(record.packVersionId).toBe(original.id);
  });

  it('rejects illegal lifecycle transitions', () => {
    const pack = createMinimalTestPack();
    const version = createPackVersion('pack-001', '0.1.0', pack);
    expect(() => applyPackVersionTransition(version, 'CERTIFY')).toThrow(
      LifecycleTransitionError,
    );
  });

  it('requires content changes to create a new draft version instead of lifecycle transition', () => {
    const pack = createMinimalTestPack();
    const original = createPackVersion('pack-001', '0.1.0', pack);
    const changed = createPackVersionFromContentChange(original, {
      ...pack,
      rules: [
        ...pack.rules,
        {
          id: 'rule-002',
          primitive: 'COMPARE',
          entityIds: [],
          factIds: [],
          authorityRefIds: [],
        },
      ],
    });

    expect(changed.packContentHash).not.toBe(original.packContentHash);
    expect(changed.state).toBe('DRAFT');
    expect(changed.id).toBe(original.id);
  });
});
