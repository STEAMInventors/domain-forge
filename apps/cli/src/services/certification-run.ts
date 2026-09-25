import {
  certifyPackVersion,
  loadCertificationProfilesFromDirectory,
} from '@domain-forge/certification';
import { DefaultQualificationStalenessEvaluator } from '@domain-forge/qualification';
import type { PackVersionId, QualificationRecordId, ReviewerRoleId } from '@domain-forge/core';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';

export interface CertificationRunInput {
  readonly packVersionId: PackVersionId;
  readonly qualificationRecordId: QualificationRecordId;
  readonly certificationProfileId: string;
  readonly certificationProfileVersion: string;
  readonly reviewerId: string;
  readonly reviewerRole: ReviewerRoleId;
  readonly reviewerCredential?: string;
  readonly notes?: string;
}

export async function runCertificationCommand(
  ctx: CliContext,
  input: CertificationRunInput,
): Promise<CommandResult> {
  const packVersion = await ctx.repos.packVersions.get(input.packVersionId);
  if (packVersion === undefined) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'PACK_VERSION_NOT_FOUND', message: `Unknown pack version ${input.packVersionId}` }],
    };
  }

  const qualificationRecord = await ctx.repos.qualifications.get(input.qualificationRecordId);
  if (qualificationRecord === undefined) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [
        {
          code: 'QUALIFICATION_RECORD_NOT_FOUND',
          message: `Unknown qualification record ${input.qualificationRecordId}`,
        },
      ],
    };
  }

  const profileLoader = loadCertificationProfilesFromDirectory(ctx.certificationProfilesDir);
  const certified = certifyPackVersion(
    {
      packVersion,
      qualificationRecord,
      certificationProfileId: input.certificationProfileId,
      certificationProfileVersion: input.certificationProfileVersion,
      reviewerId: input.reviewerId,
      reviewerRole: input.reviewerRole,
      ...(input.reviewerCredential !== undefined
        ? { reviewerCredential: input.reviewerCredential }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    {
      profileLoader,
      qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
    },
  );

  if (certified.certification === undefined) {
    return {
      exitCode: ExitCode.VALIDATION_FAILURE,
      summary: 'Certification prerequisites not satisfied',
      payload: {
        prerequisiteEvaluation: certified.prerequisiteEvaluation,
      },
      errors: certified.prerequisiteEvaluation.errors.map((error) => ({
        code: error.code,
        message: error.message,
        ...(error.path !== undefined ? { path: error.path } : {}),
      })),
    };
  }

  await ctx.repos.certificationTransactions.persistCertificationWithTransition({
    certification: certified.certification,
    packVersion: certified.packVersion!,
    transitionRecord: certified.transitionRecord!,
    expectedFromState: 'PROVISIONAL',
  });

  return {
    exitCode: ExitCode.SUCCESS,
    summary: 'Pack version certified',
    payload: {
      certificationId: certified.certification.id,
      certificationRecordFingerprint: certified.certification.recordFingerprint,
      packVersionId: certified.packVersion!.id,
      packVersionState: certified.packVersion!.state,
    },
  };
}
