export type ErrorCode =
  | 'CONFIGURATION_ERROR'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'SEMANTIC_VALIDATION_ERROR'
  | 'EVIDENCE_VERIFICATION_FAILED'
  | 'SOURCE_RETRIEVAL_ERROR'
  | 'SOURCE_NORMALIZATION_ERROR'
  | 'MODEL_INVOCATION_ERROR'
  | 'MODEL_OUTPUT_ERROR'
  | 'STAGE_PROJECTION_ERROR'
  | 'BLOCKED_CAPABILITY'
  | 'STAGE_EXECUTION_ERROR'
  | 'BUDGET_EXCEEDED'
  | 'HUMAN_GATE_REQUIRED'
  | 'CERTIFICATION_ERROR'
  | 'PERSISTENCE_ERROR'
  | 'INVARIANT_VIOLATION'
  | 'HIVE_EXECUTION_ERROR'
  | 'STALENESS_ERROR'
  | 'INDEPENDENCE_VALIDATION_FAILED'
  | 'FAILED_VALIDATION'
  | 'NEEDS_REVIEW'
  | 'SOURCE_UNAVAILABLE'
  | 'UNDETERMINED';

export interface ForgeErrorDetails {
  [key: string]: unknown;
}

export interface ForgeErrorOptions {
  code: ErrorCode;
  message: string;
  retryable?: boolean;
  runId?: string;
  stageId?: string;
  artifactId?: string;
  details?: ForgeErrorDetails;
  cause?: unknown;
}

export class ForgeError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly runId?: string;
  readonly stageId?: string;
  readonly artifactId?: string;
  readonly details?: ForgeErrorDetails;
  override readonly cause?: unknown;

  constructor(opts: ForgeErrorOptions) {
    super(opts.message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'ForgeError';
    this.code = opts.code;
    this.retryable = opts.retryable ?? false;
    if (opts.runId !== undefined) this.runId = opts.runId;
    if (opts.stageId !== undefined) this.stageId = opts.stageId;
    if (opts.artifactId !== undefined) this.artifactId = opts.artifactId;
    if (opts.details !== undefined) this.details = opts.details;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

function errorOpts(
  code: ErrorCode,
  message: string,
  details?: ForgeErrorDetails,
  extra?: Partial<ForgeErrorOptions>,
): ForgeErrorOptions {
  const opts: ForgeErrorOptions = { code, message, ...extra };
  if (details !== undefined) opts.details = details;
  return opts;
}

export class ConfigurationError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('CONFIGURATION_ERROR', message, details));
    this.name = 'ConfigurationError';
  }
}

export class SchemaValidationError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('SCHEMA_VALIDATION_ERROR', message, details));
    this.name = 'SchemaValidationError';
  }
}

export class SemanticValidationError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('SEMANTIC_VALIDATION_ERROR', message, details));
    this.name = 'SemanticValidationError';
  }
}

export class EvidenceVerificationError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('EVIDENCE_VERIFICATION_FAILED', message, details));
    this.name = 'EvidenceVerificationError';
  }
}

export class BudgetExceededError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('BUDGET_EXCEEDED', message, details, { retryable: false }));
    this.name = 'BudgetExceededError';
  }
}

export class HumanGateRequiredError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('HUMAN_GATE_REQUIRED', message, details));
    this.name = 'HumanGateRequiredError';
  }
}

export class InvariantViolationError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('INVARIANT_VIOLATION', message, details));
    this.name = 'InvariantViolationError';
  }
}

export class StageProjectionError extends ForgeError {
  constructor(message: string, details?: ForgeErrorDetails) {
    super(errorOpts('STAGE_PROJECTION_ERROR', message, details));
    this.name = 'StageProjectionError';
  }
}
