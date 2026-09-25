import { validatePack } from '@domain-forge/validation';
import type { DomainPackV0 } from '@hive/pack-contract';
import type { CommandError } from '../types.js';

export interface PackValidationSummary {
  readonly passed: boolean;
  readonly results: readonly {
    readonly validatorId: string;
    readonly validatorVersion: string;
    readonly passed: boolean;
    readonly errors: readonly CommandError[];
  }[];
}

export function runPackValidation(pack: DomainPackV0): PackValidationSummary {
  const results = validatePack(pack).map((result) => ({
    validatorId: result.validatorId,
    validatorVersion: result.validatorVersion,
    passed: result.passed,
    errors: result.errors.map((error) => ({
      code: error.code,
      message: error.message,
      ...(error.path !== undefined ? { path: error.path } : {}),
    })),
  }));

  return {
    passed: results.every((result) => result.passed),
    results,
  };
}
