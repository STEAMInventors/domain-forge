import { hashObject } from '@domain-forge/core';
import type {
  QualificationIdentityBinding,
  QualificationCoverageMetrics,
  FixtureExecutionResult,
  PackValidationResultEntry,
  QualificationReviewItem,
  QualificationResultStatus,
  RuleQualificationResult,
  ExtractionQualificationResult,
} from '@domain-forge/contracts';

/** Deterministic fingerprint of qualification evidence — excludes record id and timestamps. */
export function computeQualificationRecordFingerprint(input: {
  identity: QualificationIdentityBinding;
  status: QualificationResultStatus;
  ruleQualification?: RuleQualificationResult;
  extractionQualification?: ExtractionQualificationResult;
  fixtureResults: readonly FixtureExecutionResult[];
  coverage: QualificationCoverageMetrics;
  packValidationResults: readonly PackValidationResultEntry[];
  reviewItems: readonly QualificationReviewItem[];
}): string {
  return hashObject({
    identity: input.identity,
    status: input.status,
    ruleQualification: input.ruleQualification,
    extractionQualification: input.extractionQualification,
    fixtureResults: input.fixtureResults,
    coverage: input.coverage,
    packValidationResults: input.packValidationResults,
    reviewItems: input.reviewItems,
  });
}
