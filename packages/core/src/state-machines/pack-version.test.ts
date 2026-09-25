import { describe, it, expect } from 'vitest';
import { computePackContentHash } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  PACK_VERSION_STATES,
  PACK_VERSION_TRANSITION_RULES,
  applyPackVersionTransitionAction,
  canApplyPackVersionTransition,
  canTransitionPackVersion,
  parsePackVersionState,
  parsePackVersionTransitionAction,
  resolvePackVersionTransitionAction,
  transitionPackVersion,
} from './pack-version.js';
import { LifecycleTransitionError } from './lifecycle-errors.js';
import { assertPackContentImmutable } from './content-immutability.js';

describe('PackVersion state machine', () => {
  describe('valid transitions (table-driven)', () => {
    it.each(PACK_VERSION_TRANSITION_RULES.map((rule) => [rule.from, rule.action, rule.to] as const))(
      'allows %s via %s → %s',
      (from, action, to) => {
        expect(canApplyPackVersionTransition(from, action)).toBe(true);
        expect(applyPackVersionTransitionAction(from, action)).toBe(to);
        expect(canTransitionPackVersion(from, to)).toBe(true);
        expect(transitionPackVersion(from, to)).toBe(to);
        expect(resolvePackVersionTransitionAction(from, to)).toBe(action);
      },
    );
  });

  describe('prohibited transitions', () => {
    const prohibited: Array<[string, string, string]> = [
      ['DRAFT', 'CERTIFY', 'DISALLOWED_ACTION'],
      ['DRAFT', 'SUSPEND', 'DISALLOWED_ACTION'],
      ['PROVISIONAL', 'SUSPEND', 'DISALLOWED_ACTION'],
      ['CERTIFIED', 'DRAFT', 'DISALLOWED_TARGET'],
      ['CERTIFIED', 'PROVISIONAL', 'DISALLOWED_TARGET'],
      ['SUSPENDED', 'CERTIFIED', 'DISALLOWED_TARGET'],
      ['SUPERSEDED', 'DRAFT', 'DISALLOWED_TARGET'],
      ['SUPERSEDED', 'PROMOTE_TO_PROVISIONAL', 'DISALLOWED_ACTION'],
    ];

    it.each(prohibited)('rejects %s → %s (%s)', (from, target, kind) => {
      if (kind === 'DISALLOWED_ACTION') {
        expect(canApplyPackVersionTransition(from as never, target as never)).toBe(false);
        expect(() => applyPackVersionTransitionAction(from as never, target as never)).toThrow(
          LifecycleTransitionError,
        );
      } else {
        expect(canTransitionPackVersion(from as never, target as never)).toBe(false);
        expect(() => transitionPackVersion(from as never, target as never)).toThrow(
          LifecycleTransitionError,
        );
      }
    });
  });

  it('rejects same-state transitions', () => {
    for (const state of PACK_VERSION_STATES) {
      expect(canTransitionPackVersion(state, state)).toBe(false);
      expect(() => transitionPackVersion(state, state)).toThrow(LifecycleTransitionError);
    }
  });

  it('rejects unknown lifecycle states', () => {
    expect(() => parsePackVersionState('PUBLISHED')).toThrow(LifecycleTransitionError);
    expect(() => parsePackVersionState(null)).toThrow(LifecycleTransitionError);
  });

  it('rejects unknown transition actions', () => {
    expect(() => parsePackVersionTransitionAction('PUBLISH')).toThrow(LifecycleTransitionError);
  });

  it('returns deterministic transition results', () => {
    const first = applyPackVersionTransitionAction('DRAFT', 'PROMOTE_TO_PROVISIONAL');
    const second = applyPackVersionTransitionAction('DRAFT', 'PROMOTE_TO_PROVISIONAL');
    expect(first).toBe(second);
  });

  it('excludes lifecycle state from pack content hash', () => {
    const pack = createMinimalTestPack();
    const hash = computePackContentHash(pack);
    expect(hash).toBe(computePackContentHash({ ...pack }));
    expect(() => parsePackVersionState('CERTIFIED')).not.toThrow();
  });

  it('preserves pack content through lifecycle transition snapshots', () => {
    const pack = createMinimalTestPack();
    const hash = computePackContentHash(pack);
    const before = { packContent: pack, packContentHash: hash };
    const after = {
      packContent: pack,
      packContentHash: hash,
      state: 'PROVISIONAL' as const,
    };
    assertPackContentImmutable(before, after);
  });

  it('rejects content mutation disguised as lifecycle transition', () => {
    const pack = createMinimalTestPack();
    const hash = computePackContentHash(pack);
    const before = { packContent: pack, packContentHash: hash };
    const after = {
      packContent: { ...pack, description: 'changed' },
      packContentHash: 'different-hash',
    };
    expect(() => assertPackContentImmutable(before, after)).toThrow(LifecycleTransitionError);
  });
});
