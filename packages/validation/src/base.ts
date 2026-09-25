import type { ValidationResult, Validator, ValidatorContext } from '@domain-forge/contracts';

export function makeResult(
  validatorId: string,
  validatorVersion: string,
  passed: boolean,
  errors: ValidationResult['errors'] = [],
): ValidationResult {
  return {
    validatorId,
    validatorVersion,
    passed,
    errors,
    timestamp: new Date().toISOString(),
  };
}

export abstract class BaseValidator<T = unknown> implements Validator<T> {
  abstract readonly id: string;
  abstract readonly version: string;

  abstract validate(input: T, context?: ValidatorContext): ValidationResult;

  protected pass(): ValidationResult {
    return makeResult(this.id, this.version, true);
  }

  protected fail(errors: ValidationResult['errors']): ValidationResult {
    return makeResult(this.id, this.version, false, errors);
  }
}
