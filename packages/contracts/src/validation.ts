import type { ValidationResult } from './stage.js';

export interface ValidatorContext {
  runId?: string;
  stageId?: string;
  artifactType?: string;
}

export interface Validator<T = unknown> {
  readonly id: string;
  readonly version: string;
  validate(input: T, context?: ValidatorContext): ValidationResult;
}
