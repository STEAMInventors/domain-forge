import { asQualificationRecordId } from '@domain-forge/core';
import type {
  ExtractionQualificationResult,
  QualificationIdentityBinding,
  QualificationInput,
  QualificationRecord,
  QualificationResultStatus,
  QualificationReviewItem,
  QualificationSummary,
  RuleQualificationResult,
} from '@domain-forge/contracts';
import { computeQualificationCoverage } from './qualification-coverage.js';
import { computeQualificationRecordFingerprint } from './qualification-fingerprint.js';
import { mapExtractionQualificationState } from './qualification-staleness.js';

export function buildQualificationIdentity(input: QualificationInput): QualificationIdentityBinding {
  const { packVersion, fixtureCorpus, packCompositionHash } = input;
  return {
    packId: packVersion.packId,
    packVersion: packVersion.version,
    packContentHash: packVersion.packContentHash,
    ...(packCompositionHash !== undefined ? { packCompositionHash } : {}),
    domainId: packVersion.packContent.domainId,
    ...(packVersion.authorityCorpusHash !== undefined
      ? { authorityCorpusHash: packVersion.authorityCorpusHash }
      : {}),
    fixtureCorpusId: fixtureCorpus.corpus.corpusId,
    fixtureCorpusHash: fixtureCorpus.fixtureCorpusHash,
    qualificationProfileId: input.qualificationProfileId,
    qualificationProfileVersion: input.qualificationProfileVersion,
  };
}

function deriveSummary(
  status: QualificationResultStatus,
  identity: QualificationIdentityBinding,
  coverage: QualificationRecord['coverage'],
  reviewItems: readonly QualificationReviewItem[],
  packValidationResults: QualificationRecord['packValidationResults'],
): QualificationSummary {
  return {
    status,
    fixturesExecuted: coverage.executedFixtures,
    fixturesPassed: coverage.passedFixtures,
    fixturesFailed: coverage.failedFixtures,
    fixturesIncomplete: coverage.incompleteFixtures,
    unresolvedReviewItems: reviewItems.filter((r) => !r.resolved).length,
    failedValidatorCount: packValidationResults.filter((v) => !v.passed).length,
    fixtureCorpusHash: identity.fixtureCorpusHash,
    packContentHash: identity.packContentHash,
  };
}

export function buildQualificationRecord(
  input: QualificationInput,
  status: QualificationResultStatus,
  options?: {
    ruleQualification?: RuleQualificationResult;
    extractionQualification?: ExtractionQualificationResult;
    isStale?: boolean;
  },
): QualificationRecord {
  const identity = buildQualificationIdentity(input);
  const coverage = computeQualificationCoverage(input.fixtureExecutions);
  const packValidationResults = input.packValidationResults ?? [];
  const reviewItems = input.reviewItems ?? [];
  const executedAt = new Date().toISOString();

  const ruleQualification =
    options?.ruleQualification ??
    (input.execution.layerAMode === 'FACTS_IN'
      ? {
          status,
          executionMode: 'FACTS_IN' as const,
          executorTrustLevel: input.execution.executorTrustLevel,
          hiveVersion: input.execution.hiveVersion,
          executorVersion: input.execution.executorVersion,
        }
      : undefined);

  let extractionQualification = options?.extractionQualification;
  if (
    extractionQualification === undefined &&
    input.execution.layerBMode === 'DOCUMENTS_IN' &&
    input.execution.extractionProvider !== undefined &&
    input.execution.extractionModelFamily !== undefined &&
    input.execution.extractionModelVersion !== undefined &&
    input.execution.extractionPolicyVersion !== undefined
  ) {
    extractionQualification = {
      state: mapExtractionQualificationState(status, options?.isStale ?? false),
      executionMode: 'DOCUMENTS_IN',
      executorTrustLevel: input.execution.executorTrustLevel,
      hiveCoreVersion: input.execution.hiveVersion,
      ...(input.execution.hiveBuildId !== undefined
        ? { hiveBuildId: input.execution.hiveBuildId }
        : {}),
      extractionProvider: input.execution.extractionProvider,
      extractionModelFamily: input.execution.extractionModelFamily,
      extractionModelVersion: input.execution.extractionModelVersion,
      extractionPolicyVersion: input.execution.extractionPolicyVersion,
      qualificationPolicyVersion: input.qualificationProfileVersion,
    };
  }

  const summary = deriveSummary(
    status,
    identity,
    coverage,
    reviewItems,
    packValidationResults,
  );

  const recordFingerprint = computeQualificationRecordFingerprint({
    identity,
    status,
    ...(ruleQualification !== undefined ? { ruleQualification } : {}),
    ...(extractionQualification !== undefined ? { extractionQualification } : {}),
    fixtureResults: input.fixtureExecutions,
    coverage,
    packValidationResults,
    reviewItems,
  });

  return {
    id: asQualificationRecordId(
      `qual-${identity.packContentHash.slice(0, 12)}-${identity.fixtureCorpusHash.slice(0, 12)}-${recordFingerprint.slice(0, 12)}`,
    ),
    identity,
    execution: input.execution,
    executedAt,
    status,
    ...(ruleQualification !== undefined ? { ruleQualification } : {}),
    ...(extractionQualification !== undefined ? { extractionQualification } : {}),
    fixtureResults: input.fixtureExecutions,
    coverage,
    packValidationResults,
    reviewItems,
    summary,
    recordFingerprint,
  };
}
