import { InvariantViolationError } from '../errors.js';

/** PackVersion lifecycle — separate from ForgeRun lifecycle */
export const PACK_VERSION_STATES = [
  'DRAFT',
  'PROVISIONAL',
  'CERTIFIED',
  'SUSPENDED',
  'SUPERSEDED',
] as const;

export type PackVersionState = (typeof PACK_VERSION_STATES)[number];

const TRANSITIONS: Record<PackVersionState, readonly PackVersionState[]> = {
  DRAFT: ['PROVISIONAL'],
  PROVISIONAL: ['CERTIFIED', 'DRAFT'],
  CERTIFIED: ['SUSPENDED', 'SUPERSEDED'],
  SUSPENDED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

export function canTransitionPackVersion(
  from: PackVersionState,
  to: PackVersionState,
): boolean {
  if (from === 'CERTIFIED' && to === 'DRAFT') {
    return false;
  }
  return TRANSITIONS[from].includes(to);
}

export function transitionPackVersion(
  from: PackVersionState,
  to: PackVersionState,
): PackVersionState {
  if (!canTransitionPackVersion(from, to)) {
    throw new InvariantViolationError(
      `Invalid PackVersion transition: ${from} → ${to}`,
      { from, to },
    );
  }
  return to;
}
