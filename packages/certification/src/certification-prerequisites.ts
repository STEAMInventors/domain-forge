import { ReviewerRoleRegistry } from '@domain-forge/core';
import type {
  CertificationDecision,
  CertificationPrerequisiteEvaluation,
  CertificationProfile,
  CertificationProfileLoader,
  PackVersion,
  QualificationRecord,
  QualificationStalenessEvaluator,
} from '@domain-forge/contracts';
import { certificationError } from './certification-errors.js';

function decisionFromStatus(
  errors: ReturnType<typeof certificationError>[],
): CertificationDecision {
  if (errors.some((e) => e.code === 'CERTIFICATION_BLOCKED')) {
    return { kind: 'blocked', findings: errors.map((e) => ({ code: e.code, message: e.message })) };
  }
  if (errors.some((e) => e.code === 'QUALIFICATION_REQUIRES_REVIEW' || e.code === 'UNRESOLVED_MANDATORY_REVIEW')) {
    return {
      kind: 'requires_review',
      findings: errors.map((e) => ({ code: e.code, message: e.message })),
    };
  }
  if (errors.length > 0) {
    return { kind: 'rejected', findings: errors.map((e) => ({ code: e.code, message: e.message })) };
  }
  return { kind: 'certified' };
}

export interface EvaluateCertificationPrerequisitesInput {
  readonly packVersion: PackVersion;
  readonly qualificationRecord: QualificationRecord;
  readonly certificationProfileId: string;
  readonly certificationProfileVersion: string;
  readonly reviewerId?: string;
  readonly reviewerRole?: string;
  readonly packCompositionHash?: string;
  readonly currentFixtureCorpusHash?: string;
  readonly profileLoader: CertificationProfileLoader;
  readonly qualificationStalenessEvaluator?: QualificationStalenessEvaluator;
}

export function evaluateCertificationPrerequisites(
  input: EvaluateCertificationPrerequisitesInput,
): CertificationPrerequisiteEvaluation {
  const errors = [];

  if (input.packVersion.state !== 'PROVISIONAL') {
    errors.push(
      certificationError(
        'LIFECYCLE_PREREQUISITE_INVALID',
        `Cannot certify pack in state ${input.packVersion.state}; must be PROVISIONAL`,
        'packVersion.state',
      ),
    );
  }

  const profile = input.profileLoader.load(
    input.certificationProfileId,
    input.certificationProfileVersion,
  );
  if (profile === undefined) {
    errors.push(
      certificationError(
        'CERTIFICATION_PROFILE_MISSING',
        `Certification profile ${input.certificationProfileId}@${input.certificationProfileVersion} not found`,
        'certificationProfileId',
      ),
    );
    return {
      canCertify: false,
      decision: { kind: 'blocked', findings: errors.map((e) => ({ code: e.code, message: e.message })) },
      errors,
    };
  }

  if (
    profile.id !== input.certificationProfileId ||
    profile.version !== input.certificationProfileVersion
  ) {
    errors.push(
      certificationError(
        'CERTIFICATION_PROFILE_MISMATCH',
        'Certification profile id/version mismatch',
        'certificationProfileVersion',
      ),
    );
  }

  const qual = input.qualificationRecord;
  const identity = qual.identity;

  if (identity.packId !== input.packVersion.packId) {
    errors.push(
      certificationError('PACK_HASH_MISMATCH', 'Qualification packId mismatch', 'qualificationRecord.identity.packId'),
    );
  }

  if (identity.packVersion !== input.packVersion.version) {
    errors.push(
      certificationError(
        'PACK_HASH_MISMATCH',
        'Qualification packVersion mismatch',
        'qualificationRecord.identity.packVersion',
      ),
    );
  }

  if (identity.packContentHash !== input.packVersion.packContentHash) {
    errors.push(
      certificationError(
        'PACK_HASH_MISMATCH',
        'Qualification pack content hash mismatch',
        'qualificationRecord.identity.packContentHash',
        { expected: input.packVersion.packContentHash, actual: identity.packContentHash },
      ),
    );
  }

  if (
    input.packCompositionHash !== undefined ||
    identity.packCompositionHash !== undefined
  ) {
    if (identity.packCompositionHash !== input.packCompositionHash) {
      errors.push(
        certificationError(
          'COMPOSITION_HASH_MISMATCH',
          'Qualification composition hash mismatch',
          'qualificationRecord.identity.packCompositionHash',
        ),
      );
    }
  }

  const packAuthority = input.packVersion.authorityCorpusHash;
  if (packAuthority !== undefined || identity.authorityCorpusHash !== undefined) {
    if (identity.authorityCorpusHash !== packAuthority) {
      errors.push(
        certificationError(
          'AUTHORITY_CORPUS_MISMATCH',
          'Qualification authority corpus hash mismatch',
          'qualificationRecord.identity.authorityCorpusHash',
        ),
      );
    }
  }

  const profileAccepted = profile.requiredQualificationProfiles.some(
    (req) =>
      req.id === identity.qualificationProfileId &&
      req.version === identity.qualificationProfileVersion,
  );
  if (!profileAccepted) {
    errors.push(
      certificationError(
        'CERTIFICATION_PROFILE_MISMATCH',
        `Qualification profile ${identity.qualificationProfileId}@${identity.qualificationProfileVersion} not accepted by certification profile`,
        'qualificationRecord.identity.qualificationProfileId',
      ),
    );
  }

  if (input.qualificationStalenessEvaluator !== undefined) {
    const staleness = input.qualificationStalenessEvaluator.evaluate(qual, {
      packContentHash: input.packVersion.packContentHash,
      ...(input.packCompositionHash !== undefined
        ? { packCompositionHash: input.packCompositionHash }
        : {}),
      fixtureCorpusHash: input.currentFixtureCorpusHash ?? identity.fixtureCorpusHash,
      ...(packAuthority !== undefined ? { authorityCorpusHash: packAuthority } : {}),
      qualificationProfileId: identity.qualificationProfileId,
      qualificationProfileVersion: identity.qualificationProfileVersion,
    });
    if (staleness.isStale) {
      errors.push(
        certificationError(
          'QUALIFICATION_STALE',
          `Qualification is stale: ${staleness.reasons.join(', ')}`,
          'qualificationRecord',
          { reasons: staleness.reasons },
        ),
      );
    }
  }

  switch (qual.status) {
    case 'failed':
      errors.push(
        certificationError('QUALIFICATION_FAILED', 'Qualification status is failed', 'qualificationRecord.status'),
      );
      break;
    case 'incomplete':
      errors.push(
        certificationError(
          'QUALIFICATION_INCOMPLETE',
          'Qualification status is incomplete',
          'qualificationRecord.status',
        ),
      );
      break;
    case 'blocked':
      errors.push(
        certificationError('QUALIFICATION_BLOCKED', 'Qualification status is blocked', 'qualificationRecord.status'),
      );
      break;
    case 'requires_review':
      errors.push(
        certificationError(
          'QUALIFICATION_REQUIRES_REVIEW',
          'Qualification requires review before certification',
          'qualificationRecord.status',
        ),
      );
      break;
    case 'passed':
      break;
    default: {
      const _exhaustive: never = qual.status;
      return _exhaustive;
    }
  }

  const unresolvedReview = qual.reviewItems.filter((r) => !r.resolved);
  if (!profile.permitUnresolvedReviewItems && unresolvedReview.length > 0) {
    errors.push(
      certificationError(
        'UNRESOLVED_MANDATORY_REVIEW',
        `${unresolvedReview.length} mandatory review item(s) unresolved`,
        'qualificationRecord.reviewItems',
        { itemIds: unresolvedReview.map((r) => r.id) },
      ),
    );
  }

  for (const validatorId of profile.requiredCompletenessValidators) {
    const entry = qual.packValidationResults.find((v) => v.validatorId === validatorId);
    if (entry === undefined || !entry.passed) {
      errors.push(
        certificationError(
          'COMPLETENESS_VALIDATOR_FAILED',
          `Required completeness validator ${validatorId} did not pass`,
          'qualificationRecord.packValidationResults',
          { validatorId },
        ),
      );
    }
  }

  if (profile.layerARequired && qual.ruleQualification === undefined) {
    errors.push(
      certificationError(
        'LAYER_A_REQUIREMENT_NOT_MET',
        'Layer A rule qualification evidence is required',
        'qualificationRecord.ruleQualification',
      ),
    );
  }

  if (profile.layerBRequired) {
    if (qual.extractionQualification === undefined) {
      errors.push(
        certificationError(
          'LAYER_B_REQUIREMENT_NOT_MET',
          'Layer B extraction qualification evidence is required',
          'qualificationRecord.extractionQualification',
        ),
      );
    } else if (qual.extractionQualification.state !== 'QUALIFIED') {
      errors.push(
        certificationError(
          'LAYER_B_REQUIREMENT_NOT_MET',
          `Layer B extraction qualification state is ${qual.extractionQualification.state}`,
          'qualificationRecord.extractionQualification.state',
        ),
      );
    }
  }

  if (input.reviewerId === undefined || input.reviewerId.trim().length === 0) {
    errors.push(
      certificationError('APPROVER_MISSING', 'Certification requires an approver identity', 'reviewerId'),
    );
  }

  if (input.reviewerRole === undefined || !ReviewerRoleRegistry.has(input.reviewerRole)) {
    errors.push(
      certificationError(
        'REVIEWER_ROLE_INVALID',
        `Reviewer role ${input.reviewerRole ?? '(missing)'} is not registered`,
        'reviewerRole',
      ),
    );
  } else if (
    input.reviewerRole !== undefined &&
    !profile.requiredReviewerRoles.includes(input.reviewerRole as CertificationProfile['requiredReviewerRoles'][number])
  ) {
    errors.push(
      certificationError(
        'REVIEWER_ROLE_NOT_PERMITTED',
        `Reviewer role ${input.reviewerRole} is not permitted by certification profile`,
        'reviewerRole',
        { permitted: profile.requiredReviewerRoles },
      ),
    );
  }

  const hardBlockCodes = new Set([
    'LIFECYCLE_PREREQUISITE_INVALID',
    'CERTIFICATION_PROFILE_MISSING',
    'PACK_HASH_MISMATCH',
    'COMPOSITION_HASH_MISMATCH',
    'FIXTURE_CORPUS_MISMATCH',
    'AUTHORITY_CORPUS_MISMATCH',
    'QUALIFICATION_BLOCKED',
  ]);

  if (errors.some((e) => hardBlockCodes.has(e.code))) {
    return {
      canCertify: false,
      decision: {
        kind: 'blocked',
        findings: errors.map((e) => ({ code: e.code, message: e.message })),
      },
      errors,
    };
  }

  const decision = decisionFromStatus(errors);
  return {
    canCertify: decision.kind === 'certified',
    decision,
    errors,
  };
}
