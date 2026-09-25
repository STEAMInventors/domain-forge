import {
  invalidLifecycleTransition,
  unknownLifecycleState,
  type LifecycleTransitionError,
} from './lifecycle-errors.js';

/** PackVersion lifecycle — separate from ForgeRun lifecycle */
export const PACK_VERSION_STATES = [
  'DRAFT',
  'PROVISIONAL',
  'CERTIFIED',
  'SUSPENDED',
  'SUPERSEDED',
] as const;

export type PackVersionState = (typeof PACK_VERSION_STATES)[number];

export const PACK_VERSION_TERMINAL_STATES: readonly PackVersionState[] = ['SUPERSEDED'];

export const PACK_VERSION_TRANSITION_ACTIONS = [
  'PROMOTE_TO_PROVISIONAL',
  'REVERT_TO_DRAFT',
  'CERTIFY',
  'SUSPEND',
  'SUPERSEDE',
] as const;

export type PackVersionTransitionAction = (typeof PACK_VERSION_TRANSITION_ACTIONS)[number];

interface TransitionRule {
  from: PackVersionState;
  action: PackVersionTransitionAction;
  to: PackVersionState;
}

/** Explicit allowed transition matrix — no arbitrary state assignment. */
export const PACK_VERSION_TRANSITION_RULES: readonly TransitionRule[] = [
  { from: 'DRAFT', action: 'PROMOTE_TO_PROVISIONAL', to: 'PROVISIONAL' },
  { from: 'PROVISIONAL', action: 'REVERT_TO_DRAFT', to: 'DRAFT' },
  { from: 'PROVISIONAL', action: 'CERTIFY', to: 'CERTIFIED' },
  { from: 'CERTIFIED', action: 'SUSPEND', to: 'SUSPENDED' },
  { from: 'CERTIFIED', action: 'SUPERSEDE', to: 'SUPERSEDED' },
  { from: 'SUSPENDED', action: 'SUPERSEDE', to: 'SUPERSEDED' },
] as const;

const ACTION_TARGETS = new Map<string, PackVersionState>(
  PACK_VERSION_TRANSITION_RULES.map((rule) => [`${rule.from}:${rule.action}`, rule.to]),
);

const STATE_TARGETS = new Map<string, PackVersionTransitionAction>(
  PACK_VERSION_TRANSITION_RULES.map((rule) => [`${rule.from}:${rule.to}`, rule.action]),
);

export function isPackVersionState(value: unknown): value is PackVersionState {
  return typeof value === 'string' && (PACK_VERSION_STATES as readonly string[]).includes(value);
}

export function parsePackVersionState(value: unknown): PackVersionState {
  if (!isPackVersionState(value)) {
    throw unknownLifecycleState('PackVersion', value, PACK_VERSION_STATES);
  }
  return value;
}

export function isPackVersionTransitionAction(
  value: unknown,
): value is PackVersionTransitionAction {
  return (
    typeof value === 'string' &&
    (PACK_VERSION_TRANSITION_ACTIONS as readonly string[]).includes(value)
  );
}

export function parsePackVersionTransitionAction(
  value: unknown,
): PackVersionTransitionAction {
  if (!isPackVersionTransitionAction(value)) {
    throw invalidLifecycleTransition('PackVersion', String(value), {
      reason: 'UNKNOWN_ACTION',
      action: String(value),
    });
  }
  return value;
}

export function getPackVersionTransitionTarget(
  from: PackVersionState,
  action: PackVersionTransitionAction,
): PackVersionState | undefined {
  return ACTION_TARGETS.get(`${from}:${action}`);
}

export function canApplyPackVersionTransition(
  from: PackVersionState,
  action: PackVersionTransitionAction,
): boolean {
  return ACTION_TARGETS.has(`${from}:${action}`);
}

export function applyPackVersionTransitionAction(
  from: PackVersionState,
  action: PackVersionTransitionAction,
): PackVersionState {
  const to = getPackVersionTransitionTarget(from, action);
  if (to === undefined) {
    throw invalidLifecycleTransition('PackVersion', from, {
      reason: 'DISALLOWED_ACTION',
      action,
    });
  }
  return to;
}

export function resolvePackVersionTransitionAction(
  from: PackVersionState,
  to: PackVersionState,
): PackVersionTransitionAction | undefined {
  return STATE_TARGETS.get(`${from}:${to}`);
}

export function canTransitionPackVersion(
  from: PackVersionState,
  to: PackVersionState,
): boolean {
  if (from === to) {
    return false;
  }
  return resolvePackVersionTransitionAction(from, to) !== undefined;
}

export function transitionPackVersion(
  from: PackVersionState,
  to: PackVersionState,
): PackVersionState {
  if (from === to) {
    throw invalidLifecycleTransition('PackVersion', from, {
      reason: 'SAME_STATE',
      toState: to,
    });
  }

  const action = resolvePackVersionTransitionAction(from, to);
  if (action === undefined) {
    throw invalidLifecycleTransition('PackVersion', from, {
      reason: 'DISALLOWED_TARGET',
      toState: to,
    });
  }

  return applyPackVersionTransitionAction(from, action);
}

export function isPackVersionTerminal(state: PackVersionState): boolean {
  return PACK_VERSION_TERMINAL_STATES.includes(state);
}

export type { LifecycleTransitionError };
