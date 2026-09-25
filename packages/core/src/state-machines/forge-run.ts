import {
  invalidLifecycleTransition,
  unknownLifecycleState,
  type LifecycleTransitionError,
} from './lifecycle-errors.js';

/** ForgeRun lifecycle — separate from PackVersion lifecycle */
export const FORGE_RUN_STATES = [
  'CREATED',
  'RUNNING',
  'WAITING_FOR_HUMAN',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
] as const;

export type ForgeRunState = (typeof FORGE_RUN_STATES)[number];

export const FORGE_RUN_TERMINAL_STATES: readonly ForgeRunState[] = ['COMPLETED', 'FAILED'];
export const FORGE_RUN_RESUMABLE_STATES: readonly ForgeRunState[] = [
  'BLOCKED',
  'WAITING_FOR_HUMAN',
  'CREATED',
];

export const FORGE_RUN_TRANSITION_ACTIONS = [
  'START',
  'AWAIT_HUMAN',
  'BLOCK',
  'COMPLETE',
  'FAIL',
  'RESUME',
] as const;

export type ForgeRunTransitionAction = (typeof FORGE_RUN_TRANSITION_ACTIONS)[number];

interface TransitionRule {
  from: ForgeRunState;
  action: ForgeRunTransitionAction;
  to: ForgeRunState;
}

/** Explicit allowed transition matrix — ForgeRun never becomes CERTIFIED. */
export const FORGE_RUN_TRANSITION_RULES: readonly TransitionRule[] = [
  { from: 'CREATED', action: 'START', to: 'RUNNING' },
  { from: 'RUNNING', action: 'AWAIT_HUMAN', to: 'WAITING_FOR_HUMAN' },
  { from: 'RUNNING', action: 'BLOCK', to: 'BLOCKED' },
  { from: 'RUNNING', action: 'COMPLETE', to: 'COMPLETED' },
  { from: 'RUNNING', action: 'FAIL', to: 'FAILED' },
  { from: 'WAITING_FOR_HUMAN', action: 'RESUME', to: 'RUNNING' },
  { from: 'BLOCKED', action: 'RESUME', to: 'RUNNING' },
] as const;

const ACTION_TARGETS = new Map<string, ForgeRunState>(
  FORGE_RUN_TRANSITION_RULES.map((rule) => [`${rule.from}:${rule.action}`, rule.to]),
);

const STATE_TARGETS = new Map<string, ForgeRunTransitionAction>(
  FORGE_RUN_TRANSITION_RULES.map((rule) => [`${rule.from}:${rule.to}`, rule.action]),
);

export function isForgeRunState(value: unknown): value is ForgeRunState {
  return typeof value === 'string' && (FORGE_RUN_STATES as readonly string[]).includes(value);
}

export function parseForgeRunState(value: unknown): ForgeRunState {
  if (!isForgeRunState(value)) {
    throw unknownLifecycleState('ForgeRun', value, FORGE_RUN_STATES);
  }
  return value;
}

export function isForgeRunTransitionAction(value: unknown): value is ForgeRunTransitionAction {
  return (
    typeof value === 'string' && (FORGE_RUN_TRANSITION_ACTIONS as readonly string[]).includes(value)
  );
}

export function parseForgeRunTransitionAction(value: unknown): ForgeRunTransitionAction {
  if (!isForgeRunTransitionAction(value)) {
    throw invalidLifecycleTransition('ForgeRun', String(value), {
      reason: 'UNKNOWN_ACTION',
      action: String(value),
    });
  }
  return value;
}

export function getForgeRunTransitionTarget(
  from: ForgeRunState,
  action: ForgeRunTransitionAction,
): ForgeRunState | undefined {
  return ACTION_TARGETS.get(`${from}:${action}`);
}

export function canApplyForgeRunTransition(
  from: ForgeRunState,
  action: ForgeRunTransitionAction,
): boolean {
  return ACTION_TARGETS.has(`${from}:${action}`);
}

export function applyForgeRunTransitionAction(
  from: ForgeRunState,
  action: ForgeRunTransitionAction,
): ForgeRunState {
  const to = getForgeRunTransitionTarget(from, action);
  if (to === undefined) {
    throw invalidLifecycleTransition('ForgeRun', from, {
      reason: 'DISALLOWED_ACTION',
      action,
    });
  }
  return to;
}

export function resolveForgeRunTransitionAction(
  from: ForgeRunState,
  to: ForgeRunState,
): ForgeRunTransitionAction | undefined {
  return STATE_TARGETS.get(`${from}:${to}`);
}

export function canTransitionForgeRun(from: ForgeRunState, to: ForgeRunState): boolean {
  if (from === to) {
    return false;
  }
  return resolveForgeRunTransitionAction(from, to) !== undefined;
}

export function transitionForgeRun(from: ForgeRunState, to: ForgeRunState): ForgeRunState {
  if (from === to) {
    throw invalidLifecycleTransition('ForgeRun', from, {
      reason: 'SAME_STATE',
      toState: to,
    });
  }

  const action = resolveForgeRunTransitionAction(from, to);
  if (action === undefined) {
    throw invalidLifecycleTransition('ForgeRun', from, {
      reason: 'DISALLOWED_TARGET',
      toState: to,
    });
  }

  return applyForgeRunTransitionAction(from, action);
}

export function isForgeRunTerminal(state: ForgeRunState): boolean {
  return FORGE_RUN_TERMINAL_STATES.includes(state);
}

export function isForgeRunResumable(state: ForgeRunState): boolean {
  return FORGE_RUN_RESUMABLE_STATES.includes(state);
}

export type { LifecycleTransitionError };
