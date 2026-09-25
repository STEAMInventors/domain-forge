/** Deterministic CLI exit codes for automation. */
export const ExitCode = {
  SUCCESS: 0,
  VALIDATION_FAILURE: 1,
  BLOCKED_OR_REVIEW: 2,
  USAGE_OR_CONFIG: 3,
  INTERNAL_FAILURE: 4,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
