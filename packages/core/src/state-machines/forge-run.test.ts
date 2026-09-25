import { describe, it, expect } from 'vitest';
import {
  FORGE_RUN_STATES,
  FORGE_RUN_TRANSITION_RULES,
  applyForgeRunTransitionAction,
  canApplyForgeRunTransition,
  canTransitionForgeRun,
  isForgeRunTerminal,
  parseForgeRunState,
  parseForgeRunTransitionAction,
  resolveForgeRunTransitionAction,
  transitionForgeRun,
} from './forge-run.js';
import { LifecycleTransitionError } from './lifecycle-errors.js';

describe('ForgeRun state machine', () => {
  describe('valid transitions (table-driven)', () => {
    it.each(FORGE_RUN_TRANSITION_RULES.map((rule) => [rule.from, rule.action, rule.to] as const))(
      'allows %s via %s → %s',
      (from, action, to) => {
        expect(canApplyForgeRunTransition(from, action)).toBe(true);
        expect(applyForgeRunTransitionAction(from, action)).toBe(to);
        expect(canTransitionForgeRun(from, to)).toBe(true);
        expect(transitionForgeRun(from, to)).toBe(to);
        expect(resolveForgeRunTransitionAction(from, to)).toBe(action);
      },
    );
  });

  describe('prohibited transitions', () => {
    const prohibited: Array<[string, string, string]> = [
      ['CREATED', 'COMPLETE', 'DISALLOWED_ACTION'],
      ['CREATED', 'FAIL', 'DISALLOWED_ACTION'],
      ['RUNNING', 'START', 'DISALLOWED_ACTION'],
      ['COMPLETED', 'RUNNING', 'DISALLOWED_TARGET'],
      ['FAILED', 'RUNNING', 'DISALLOWED_TARGET'],
      ['WAITING_FOR_HUMAN', 'COMPLETE', 'DISALLOWED_ACTION'],
    ];

    it.each(prohibited)('rejects %s → %s (%s)', (from, target, kind) => {
      if (kind === 'DISALLOWED_ACTION') {
        expect(canApplyForgeRunTransition(from as never, target as never)).toBe(false);
        expect(() => applyForgeRunTransitionAction(from as never, target as never)).toThrow(
          LifecycleTransitionError,
        );
      } else {
        expect(canTransitionForgeRun(from as never, target as never)).toBe(false);
        expect(() => transitionForgeRun(from as never, target as never)).toThrow(
          LifecycleTransitionError,
        );
      }
    });
  });

  it('rejects same-state transitions', () => {
    for (const state of FORGE_RUN_STATES) {
      expect(canTransitionForgeRun(state, state)).toBe(false);
      expect(() => transitionForgeRun(state, state)).toThrow(LifecycleTransitionError);
    }
  });

  it('rejects unknown lifecycle states', () => {
    expect(() => parseForgeRunState('CERTIFIED')).toThrow(LifecycleTransitionError);
  });

  it('rejects unknown transition actions', () => {
    expect(() => parseForgeRunTransitionAction('CERTIFY')).toThrow(LifecycleTransitionError);
  });

  it('ForgeRun never becomes CERTIFIED', () => {
    expect(FORGE_RUN_STATES).not.toContain('CERTIFIED');
    expect(() => parseForgeRunState('CERTIFIED')).toThrow(LifecycleTransitionError);
  });

  it('marks terminal states', () => {
    expect(isForgeRunTerminal('COMPLETED')).toBe(true);
    expect(isForgeRunTerminal('FAILED')).toBe(true);
    expect(isForgeRunTerminal('RUNNING')).toBe(false);
  });

  it('returns deterministic transition results', () => {
    const first = applyForgeRunTransitionAction('CREATED', 'START');
    const second = applyForgeRunTransitionAction('CREATED', 'START');
    expect(first).toBe(second);
  });
});
