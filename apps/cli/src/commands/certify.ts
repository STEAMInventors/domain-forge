import type { PackVersionId, QualificationRecordId, ReviewerRoleId } from '@domain-forge/core';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import { runCertificationCommand } from '../services/certification-run.js';

export async function cmdCertify(ctx: CliContext, args: readonly string[]): Promise<CommandResult> {
  const [
    packVersionId,
    qualificationRecordId,
    certificationProfileId,
    certificationProfileVersion,
    reviewerId,
    reviewerRole,
  ] = args;

  if (
    !packVersionId ||
    !qualificationRecordId ||
    !certificationProfileId ||
    !certificationProfileVersion ||
    !reviewerId ||
    !reviewerRole
  ) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary:
        'Usage: certify <packVersionId> <qualificationRecordId> <certificationProfileId> <certificationProfileVersion> <reviewerId> <reviewerRole>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing certify arguments' }],
    };
  }

  return runCertificationCommand(ctx, {
    packVersionId: packVersionId as PackVersionId,
    qualificationRecordId: qualificationRecordId as QualificationRecordId,
    certificationProfileId,
    certificationProfileVersion,
    reviewerId,
    reviewerRole: reviewerRole as ReviewerRoleId,
  });
}
