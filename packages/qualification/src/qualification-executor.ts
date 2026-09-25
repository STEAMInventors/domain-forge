import { ReviewerRoleRegistry } from '@domain-forge/core';
import type {
  FixtureExecutionResult,
  ProposedFixtureBundle,
  QualificationExecutionResult,
  QualificationInput,
  QualificationProfile,
  QualificationProfileLoader,
  QualificationResultStatus,
  QualificationReviewItem,
} from '@domain-forge/contracts';
import { computeFixtureCorpusHash } from '@domain-forge/fixtures';
import {
  ExtractionContractCompletenessValidator,
  OutputSpecificationCompletenessValidator,
  SchemaValidator,
} from '@domain-forge/validation';
import { qualificationError } from './qualification-errors.js';
import { DefaultPackFixtureReferenceValidator } from './fixture-reference-validation.js';
import { buildQualificationRecord } from './qualification-record-builder.js';

function isProposedFixtureBundle(value: unknown): value is ProposedFixtureBundle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ProposedFixtureBundle).source === 'MODEL'
  );
}

function extractGoldFindings(result: FixtureExecutionResult) {
  const findings = result.goldEvaluation?.findings ?? [];
  return {
    forbiddenArtifacts: findings.filter((f) => f.status === 'forbidden_artifact_produced'),
    evidenceMismatches: findings.filter((f) => f.status === 'incorrect_evidence'),
    missingExpectations: findings.filter(
      (f) => f.status === 'missing' || f.status === 'unexpected',
    ),
  };
}

function enrichFixtureResults(
  results: readonly FixtureExecutionResult[],
): readonly FixtureExecutionResult[] {
  return results.map((result) => {
    const extracted = extractGoldFindings(result);
    return {
      ...result,
      ...(extracted.forbiddenArtifacts.length > 0
        ? { forbiddenArtifacts: extracted.forbiddenArtifacts }
        : {}),
      ...(extracted.evidenceMismatches.length > 0
        ? { evidenceMismatches: extracted.evidenceMismatches }
        : {}),
      ...(extracted.missingExpectations.length > 0
        ? { missingExpectations: extracted.missingExpectations }
        : {}),
    };
  });
}

function runPackValidationResults(pack: QualificationInput['packVersion']['packContent']) {
  const validators = [
    new SchemaValidator(),
    new ExtractionContractCompletenessValidator(),
    new OutputSpecificationCompletenessValidator(),
  ];

  return validators.map((validator) => {
    const result = validator.validate(pack);
    return {
      validatorId: validator.id,
      validatorVersion: validator.version,
      passed: result.passed,
      ...(result.errors.length > 0
        ? {
            errors: result.errors.map((e) => ({
              code: e.code,
              message: e.message,
              ...(e.path !== undefined ? { path: e.path } : {}),
            })),
          }
        : {}),
    };
  });
}

function resolveStatus(input: {
  hardBlocked: boolean;
  hasIncomplete: boolean;
  hasFailedFixtures: boolean;
  hasUnresolvedReview: boolean;
  validatorFailures: boolean;
  missingRequiredFixtures: boolean;
  untrustedExecutor: boolean;
}): QualificationResultStatus {
  if (input.hardBlocked) return 'blocked';
  if (input.untrustedExecutor) return 'blocked';
  if (input.hasIncomplete || input.missingRequiredFixtures) return 'incomplete';
  if (input.hasUnresolvedReview) return 'requires_review';
  if (input.validatorFailures || input.hasFailedFixtures) return 'failed';
  return 'passed';
}

function collectReviewItems(
  profile: QualificationProfile,
  fixtureExecutions: readonly FixtureExecutionResult[],
  existing: readonly QualificationReviewItem[],
): QualificationReviewItem[] {
  const items: QualificationReviewItem[] = [...existing];

  for (const requirement of profile.humanReviewRequirements) {
    const categories = requirement.requiredForCategories ?? profile.requiredFixtureCategories;
    const needsReview = fixtureExecutions.some(
      (f) =>
        categories.includes(f.fixtureCategory) &&
        (f.executionStatus === 'incomplete' ||
          f.goldEvaluation?.findings.some((finding) => finding.status !== 'match')),
    );
    if (needsReview) {
      items.push({
        id: `review-${requirement.reviewerRole}-${categories.join('-')}`,
        kind: 'human_interpretation',
        message: `Human review required for role ${requirement.reviewerRole}`,
        reviewerRole: requirement.reviewerRole,
        resolved: false,
      });
    }
  }

  if (profile.coverageRequirements.minSyntheticFixtures !== undefined) {
    const syntheticExecuted = fixtureExecutions.filter(
      (r) => r.materialClass === 'synthetic' && r.executionStatus === 'completed',
    ).length;
    if (syntheticExecuted < profile.coverageRequirements.minSyntheticFixtures) {
      items.push({
        id: 'coverage-synthetic',
        kind: 'coverage_gap',
        message: `Synthetic fixture coverage ${syntheticExecuted}/${profile.coverageRequirements.minSyntheticFixtures}`,
        resolved: false,
      });
    }
  }

  if (profile.coverageRequirements.minRealCorpusFixtures !== undefined) {
    const realExecuted = fixtureExecutions.filter(
      (r) => r.materialClass === 'real_corpus' && r.executionStatus === 'completed',
    ).length;
    if (realExecuted < profile.coverageRequirements.minRealCorpusFixtures) {
      items.push({
        id: 'coverage-real-corpus',
        kind: 'coverage_gap',
        message: `Real corpus fixture coverage ${realExecuted}/${profile.coverageRequirements.minRealCorpusFixtures}`,
        resolved: false,
      });
    }
  }

  return items;
}

export interface DefaultQualificationExecutorOptions {
  profileLoader: QualificationProfileLoader;
}

export class DefaultQualificationExecutor {
  private readonly profileLoader: QualificationProfileLoader;
  private readonly fixtureRefValidator = new DefaultPackFixtureReferenceValidator();

  constructor(options: DefaultQualificationExecutorOptions) {
    this.profileLoader = options.profileLoader;
  }

  execute(input: QualificationInput): QualificationExecutionResult {
    const errors = [];

    if (isProposedFixtureBundle(input.fixtureCorpus)) {
      return {
        status: 'blocked',
        errors: [
          qualificationError(
            'FIXTURE_NOT_APPROVED',
            'Qualification requires an approved fixture corpus; model proposals cannot qualify',
          ),
        ],
      };
    }

    const profile = this.profileLoader.load(
      input.qualificationProfileId,
      input.qualificationProfileVersion,
    );
    if (profile === undefined) {
      return {
        status: 'blocked',
        errors: [
          qualificationError(
            'QUALIFICATION_PROFILE_MISSING',
            `Qualification profile ${input.qualificationProfileId}@${input.qualificationProfileVersion} not found`,
          ),
        ],
      };
    }

    if (profile.id !== input.qualificationProfileId) {
      errors.push(
        qualificationError(
          'QUALIFICATION_PROFILE_VERSION_MISMATCH',
          'Profile id mismatch',
          'qualificationProfileId',
        ),
      );
    }
    if (profile.version !== input.qualificationProfileVersion) {
      errors.push(
        qualificationError(
          'QUALIFICATION_PROFILE_VERSION_MISMATCH',
          'Profile version mismatch',
          'qualificationProfileVersion',
        ),
      );
    }

    if (!profile.allowedPackVersionStates.includes(input.packVersion.state)) {
      errors.push(
        qualificationError(
          'PACK_NOT_ELIGIBLE',
          `Pack version state ${input.packVersion.state} is not eligible for qualification`,
          'packVersion.state',
          { allowed: profile.allowedPackVersionStates },
        ),
      );
    }

    const computedFixtureHash = computeFixtureCorpusHash(input.fixtureCorpus.corpus);
    if (computedFixtureHash !== input.fixtureCorpus.fixtureCorpusHash) {
      errors.push(
        qualificationError(
          'FIXTURE_CORPUS_MISMATCH',
          'Accepted fixture corpus hash does not match corpus content',
          'fixtureCorpus.fixtureCorpusHash',
          { expected: input.fixtureCorpus.fixtureCorpusHash, actual: computedFixtureHash },
        ),
      );
    }

    errors.push(
      ...this.fixtureRefValidator.validate(
        input.packVersion.packContent,
        input.fixtureCorpus,
        input.packVersion.packContentHash,
      ),
    );

    for (const requirement of profile.humanReviewRequirements) {
      if (!ReviewerRoleRegistry.has(requirement.reviewerRole)) {
        errors.push(
          qualificationError(
            'UNRESOLVED_REVIEWER_ROLE',
            `Unknown reviewer role ${requirement.reviewerRole}`,
            'humanReviewRequirements',
          ),
        );
      }
    }

    const untrustedExecutor =
      input.execution.executorTrustLevel !== profile.requiredExecutionTrust;

    const packFixtureIds = input.packVersion.packContent.fixtureReferences.flatMap((ref) =>
      ref.fixtureIds.length > 0 ? ref.fixtureIds : [],
    );
    const requiredFixtureIds = new Set(packFixtureIds);
    const executedIds = new Set(input.fixtureExecutions.map((f) => f.fixtureId));
    let missingRequiredFixtures = false;

    for (const fixtureId of requiredFixtureIds) {
      if (!executedIds.has(fixtureId)) {
        missingRequiredFixtures = true;
        errors.push(
          qualificationError(
            'REQUIRED_FIXTURE_MISSING',
            `Required fixture ${fixtureId} was not executed`,
            'fixtureExecutions',
            { fixtureId },
          ),
        );
      }
    }

    const enrichedExecutions = enrichFixtureResults(input.fixtureExecutions);

    const hasIncomplete = enrichedExecutions.some(
      (r) => r.executionStatus === 'incomplete' || r.executionStatus === 'blocked',
    );
    const hasFailedFixtures = enrichedExecutions.some(
      (r) =>
        r.executionStatus === 'completed' &&
        (r.goldEvaluation === undefined || !r.goldEvaluation.passed),
    );

    const completenessResults = runPackValidationResults(input.packVersion.packContent);
    const validatorFailures = completenessResults.some(
      (r) =>
        profile.requiredCompletenessValidators.includes(
          r.validatorId as (typeof profile.requiredCompletenessValidators)[number],
        ) && !r.passed,
    );

    const packValidationResults = [
      ...(input.packValidationResults ?? []),
      ...completenessResults,
    ];

    const reviewItems = collectReviewItems(
      profile,
      enrichedExecutions,
      input.reviewItems ?? [],
    );

    const hasUnresolvedReview = reviewItems.some((r) => !r.resolved);

    const hardBlocked = errors.some(
      (e) =>
        e.code === 'FIXTURE_CORPUS_MISMATCH' ||
        e.code === 'FIXTURE_REFERENCE_MISMATCH' ||
        e.code === 'PACK_HASH_MISMATCH' ||
        e.code === 'PACK_NOT_ELIGIBLE' ||
        e.code === 'QUALIFICATION_PROFILE_MISSING' ||
        e.code === 'QUALIFICATION_PROFILE_VERSION_MISMATCH' ||
        e.code === 'UNRESOLVED_REVIEWER_ROLE' ||
        e.code === 'FIXTURE_NOT_APPROVED',
    );

    const status = resolveStatus({
      hardBlocked,
      hasIncomplete,
      hasFailedFixtures,
      hasUnresolvedReview,
      validatorFailures,
      missingRequiredFixtures,
      untrustedExecutor,
    });

    if (
      status === 'passed' &&
      (hasFailedFixtures || validatorFailures || hasIncomplete || hasUnresolvedReview)
    ) {
      return {
        status: 'blocked',
        errors: [
          qualificationError(
            'CONTRADICTORY_QUALIFICATION_STATUS',
            'Qualification status cannot be passed with unresolved failures',
          ),
        ],
      };
    }

    const executionInput: QualificationInput = {
      ...input,
      fixtureExecutions: enrichedExecutions,
      packValidationResults,
      reviewItems,
    };

    const record = buildQualificationRecord(executionInput, status);

    return {
      status,
      errors,
      record,
    };
  }
}
