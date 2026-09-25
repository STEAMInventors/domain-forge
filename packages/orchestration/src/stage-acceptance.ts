import { hashObject } from '@domain-forge/core';
import type {
  StageAcceptanceResult,
  StageProposedOutput,
  ValidationResult,
} from '@domain-forge/contracts';
import { stageFailure } from '@domain-forge/contracts';

export type StageOutputValidator = (output: unknown) => ValidationResult;

/**
 * Generic acceptance boundary:
 * proposed model output → schema/guard validation → accepted output | failure | review
 *
 * Does not manufacture accepted artifacts on failure and does not guess missing values.
 */
export function runStageAcceptanceBoundary(
  proposed: StageProposedOutput,
  validators: readonly StageOutputValidator[],
  attemptNumber: number,
): StageAcceptanceResult {
  if (proposed.parsed === undefined) {
    return {
      status: 'VALIDATION_FAILED',
      proposed,
      validationResults: [],
      failure: stageFailure('MODEL_OUTPUT_ERROR', 'Model response could not be parsed as structured output', {
        details: { rawResponseHash: proposed.rawResponseHash },
      }),
    };
  }

  const validationResults: ValidationResult[] = [];
  for (const validator of validators) {
    const result = validator(proposed.parsed);
    validationResults.push(result);
    if (!result.passed) {
      const needsReview = result.errors.some((e) => e.code === 'NEEDS_REVIEW');
      if (needsReview) {
        return {
          status: 'NEEDS_REVIEW',
          proposed,
          validationResults,
          reviewReason: stageFailure('HUMAN_REVIEW_REQUIRED', 'Deterministic validation requires human review', {
            details: { validatorId: result.validatorId },
          }),
        };
      }

      const hasSchemaError = result.errors.some((e) => e.code === 'SCHEMA_VALIDATION_ERROR');
      return {
        status: 'VALIDATION_FAILED',
        proposed,
        validationResults,
        failure: stageFailure(
          hasSchemaError ? 'SCHEMA_VALIDATION_ERROR' : 'DETERMINISTIC_VALIDATION_FAILED',
          result.errors.map((e) => e.message).join('; '),
          {
            details: {
              validatorId: result.validatorId,
              errors: result.errors,
            },
          },
        ),
      };
    }
  }

  const content = proposed.parsed;
  return {
    status: 'ACCEPTED',
    proposed,
    accepted: {
      source: 'VALIDATED',
      content,
      contentHash: hashObject(content),
      validationResults,
      proposedOutputRef: {
        rawResponseHash: proposed.rawResponseHash,
        attemptNumber,
      },
    },
  };
}
