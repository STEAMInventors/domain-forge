import {
  applyPackVersionTransitionAction,
  assertPackContentImmutable,
  createPackVersionTransitionRecord,
  InvariantViolationError,
  type PackVersionTransitionRecord,
} from '@domain-forge/core';
import type {
  CertifyPackVersionInput,
  CertifyPackVersionResult,
  CertificationPrerequisiteEvaluation,
  CertificationProfileLoader,
  CertificationRecord,
  QualificationStalenessEvaluator,
} from '@domain-forge/contracts';
import { DefaultQualificationStalenessEvaluator } from '@domain-forge/qualification';
import { evaluateCertificationPrerequisites } from './certification-prerequisites.js';
import { createCertificationRecord } from './certification-record-builder.js';
import { loadCertificationProfilesFromDirectory } from './config-loader.js';
import { createCertificationProfileLoader } from './certification-profile.js';

export interface CertifyPackVersionOptions {
  readonly profileLoader?: CertificationProfileLoader;
  readonly qualificationStalenessEvaluator?: QualificationStalenessEvaluator;
}

export function evaluateCertificationPrerequisitesForPack(
  input: Omit<CertifyPackVersionInput, 'reviewerCredential' | 'notes'> & {
    profileLoader?: CertificationProfileLoader;
    qualificationStalenessEvaluator?: QualificationStalenessEvaluator;
  },
): CertificationPrerequisiteEvaluation {
  const profileLoader =
    input.profileLoader ??
    createCertificationProfileLoader([]);

  return evaluateCertificationPrerequisites({
    packVersion: input.packVersion,
    qualificationRecord: input.qualificationRecord,
    certificationProfileId: input.certificationProfileId,
    certificationProfileVersion: input.certificationProfileVersion,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    ...(input.packCompositionHash !== undefined
      ? { packCompositionHash: input.packCompositionHash }
      : {}),
    profileLoader,
    qualificationStalenessEvaluator:
      input.qualificationStalenessEvaluator ?? new DefaultQualificationStalenessEvaluator(),
  });
}

export function certifyPackVersion(
  input: CertifyPackVersionInput,
  options?: CertifyPackVersionOptions,
): CertifyPackVersionResult {
  const profileLoader =
    options?.profileLoader ?? createCertificationProfileLoader([]);

  const prerequisiteEvaluation = evaluateCertificationPrerequisites({
    packVersion: input.packVersion,
    qualificationRecord: input.qualificationRecord,
    certificationProfileId: input.certificationProfileId,
    certificationProfileVersion: input.certificationProfileVersion,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    ...(input.packCompositionHash !== undefined
      ? { packCompositionHash: input.packCompositionHash }
      : {}),
    profileLoader,
    qualificationStalenessEvaluator:
      options?.qualificationStalenessEvaluator ?? new DefaultQualificationStalenessEvaluator(),
  });

  if (!prerequisiteEvaluation.canCertify) {
    return { prerequisiteEvaluation };
  }

  const certification = createCertificationRecord({
    qualificationRecord: input.qualificationRecord,
    certificationProfileId: input.certificationProfileId,
    certificationProfileVersion: input.certificationProfileVersion,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    ...(input.reviewerCredential !== undefined
      ? { reviewerCredential: input.reviewerCredential }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.packCompositionHash !== undefined
      ? { packCompositionHash: input.packCompositionHash }
      : {}),
    decision: prerequisiteEvaluation.decision,
  });

  const fromState = input.packVersion.state;
  const toState = applyPackVersionTransitionAction(fromState, 'CERTIFY');
  const certifiedPack = {
    ...input.packVersion,
    state: toState,
    updatedAt: new Date().toISOString(),
  };
  assertPackContentImmutable(input.packVersion, certifiedPack);

  const transitionRecord = createPackVersionTransitionRecord(
    {
      packVersionId: input.packVersion.id,
      packId: input.packVersion.packId,
      version: input.packVersion.version,
      packContentHash: input.packVersion.packContentHash,
    },
    { fromState, toState, action: 'CERTIFY' },
    { actorRef: input.reviewerId, reasonRef: certification.id },
  );

  return {
    certification,
    packVersion: certifiedPack,
    transitionRecord,
    prerequisiteEvaluation,
  };
}

/** @deprecated Use certifyPackVersion with QualificationRecord — kept for compile compatibility. */
export interface CertifyPackInput {
  packVersion: CertifyPackVersionInput['packVersion'];
  reviewerId: string;
  reviewerRole: string;
  reviewerCredential?: string;
  notes?: string;
}

/** Legacy entry point — fails closed without qualification evidence. */
export function certifyProvisionalPack(input: CertifyPackInput): {
  certification: CertificationRecord;
  packVersion: CertifyPackVersionInput['packVersion'];
  transitionRecord: PackVersionTransitionRecord;
} {
  throw new InvariantViolationError(
    'certifyProvisionalPack requires QualificationRecord evidence; use certifyPackVersion (Step 15)',
    { reviewerId: input.reviewerId },
  );
}

export { loadCertificationProfilesFromDirectory };
