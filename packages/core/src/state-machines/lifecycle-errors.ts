import { ForgeError } from '../errors.js';

export type LifecycleErrorCode =
  | 'UNKNOWN_LIFECYCLE_STATE'
  | 'INVALID_LIFECYCLE_TRANSITION'
  | 'LIFECYCLE_CONTENT_MUTATION';

export interface LifecycleTransitionErrorDetails {
  machine: 'PackVersion' | 'ForgeRun';
  reason: string;
  fromState?: string;
  toState?: string;
  action?: string;
  allowedStates?: string[];
  field?: string;
  before?: string;
  after?: string;
}

export class LifecycleTransitionError extends ForgeError {
  readonly machine: 'PackVersion' | 'ForgeRun';
  readonly lifecycleReason: string;

  constructor(
    code: LifecycleErrorCode,
    machine: 'PackVersion' | 'ForgeRun',
    message: string,
    details: Omit<LifecycleTransitionErrorDetails, 'machine'>,
  ) {
    super({
      code,
      message,
      details: { machine, ...details },
    });
    this.name = 'LifecycleTransitionError';
    this.machine = machine;
    this.lifecycleReason = details.reason;
  }
}

export function unknownLifecycleState(
  machine: 'PackVersion' | 'ForgeRun',
  value: unknown,
  allowedStates: readonly string[],
): LifecycleTransitionError {
  return new LifecycleTransitionError(
    'UNKNOWN_LIFECYCLE_STATE',
    machine,
    `Unknown ${machine} lifecycle state: ${String(value)}`,
    {
      reason: 'UNKNOWN_STATE',
      fromState: String(value),
      allowedStates: [...allowedStates],
    },
  );
}

export function invalidLifecycleTransition(
  machine: 'PackVersion' | 'ForgeRun',
  fromState: string,
  details: { toState?: string; action?: string; reason: string },
): LifecycleTransitionError {
  const target = details.action ?? details.toState ?? 'unknown';
  return new LifecycleTransitionError(
    'INVALID_LIFECYCLE_TRANSITION',
    machine,
    `Invalid ${machine} lifecycle transition: ${fromState} → ${target}`,
    { fromState, ...details },
  );
}

export function lifecycleContentMutation(
  machine: 'PackVersion' | 'ForgeRun',
  details: { field: string; before: string; after: string },
): LifecycleTransitionError {
  return new LifecycleTransitionError(
    'LIFECYCLE_CONTENT_MUTATION',
    machine,
    `Lifecycle transition must not mutate pack content (${details.field})`,
    {
      reason: 'CONTENT_MUTATION',
      field: details.field,
      before: details.before,
      after: details.after,
    },
  );
}
