import { InvariantViolationError } from '../errors.js';

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

const TRANSITIONS: Record<ForgeRunState, readonly ForgeRunState[]> = {
  CREATED: ['RUNNING'],
  RUNNING: ['WAITING_FOR_HUMAN', 'BLOCKED', 'COMPLETED', 'FAILED'],
  WAITING_FOR_HUMAN: ['RUNNING'],
  BLOCKED: ['RUNNING'],
  COMPLETED: [],
  FAILED: [],
};

export function canTransitionForgeRun(from: ForgeRunState, to: ForgeRunState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionForgeRun(from: ForgeRunState, to: ForgeRunState): ForgeRunState {
  if (!canTransitionForgeRun(from, to)) {
    throw new InvariantViolationError(
      `Invalid ForgeRun transition: ${from} → ${to}`,
      { from, to },
    );
  }
  return to;
}

export function isForgeRunTerminal(state: ForgeRunState): boolean {
  return FORGE_RUN_TERMINAL_STATES.includes(state);
}

export function isForgeRunResumable(state: ForgeRunState): boolean {
  return FORGE_RUN_RESUMABLE_STATES.includes(state);
}
