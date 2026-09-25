/** Stable machine-readable stage/runtime error codes */
export const STAGE_ERROR_CODES = [
  'INVALID_STAGE_INPUT',
  'STAGE_PROJECTION_ERROR',
  'MODEL_INVOCATION_ERROR',
  'MODEL_OUTPUT_ERROR',
  'SCHEMA_VALIDATION_ERROR',
  'DETERMINISTIC_VALIDATION_FAILED',
  'BLOCKED_PREREQUISITE',
  'HUMAN_REVIEW_REQUIRED',
  'HUMAN_GATE_REQUIRED',
  'STAGE_EXECUTION_ERROR',
  'BUDGET_EXCEEDED',
  'BLOCKED_CAPABILITY',
] as const;

export type StageErrorCode = (typeof STAGE_ERROR_CODES)[number];

export interface StageFailureDetail {
  readonly code: StageErrorCode;
  readonly message: string;
  readonly retryable?: boolean;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function isStageErrorCode(value: unknown): value is StageErrorCode {
  return typeof value === 'string' && (STAGE_ERROR_CODES as readonly string[]).includes(value);
}

export function stageFailure(
  code: StageErrorCode,
  message: string,
  opts?: {
    retryable?: boolean;
    path?: string;
    details?: Readonly<Record<string, unknown>>;
  },
): StageFailureDetail {
  return {
    code,
    message,
    ...(opts?.retryable !== undefined ? { retryable: opts.retryable } : {}),
    ...(opts?.path !== undefined ? { path: opts.path } : {}),
    ...(opts?.details !== undefined ? { details: opts.details } : {}),
  };
}
