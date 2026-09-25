import type { PackVersionId } from '@domain-forge/core';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import { runQualificationCommand } from '../services/qualification-run.js';

export async function cmdQualify(ctx: CliContext, args: readonly string[]): Promise<CommandResult> {
  const [
    packVersionId,
    qualificationProfileId,
    qualificationProfileVersion,
    fixtureCorpusHash,
    executionRunId,
    executorTrustLevel,
    hiveVersion,
    executorVersion,
  ] = args;

  if (
    !packVersionId ||
    !qualificationProfileId ||
    !qualificationProfileVersion ||
    !fixtureCorpusHash ||
    !executionRunId ||
    !executorTrustLevel ||
    !hiveVersion ||
    !executorVersion
  ) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary:
        'Usage: qualify <packVersionId> <qualificationProfileId> <qualificationProfileVersion> <fixtureCorpusHash> <executionRunId> <executorTrustLevel> <hiveVersion> <executorVersion>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing qualify arguments' }],
    };
  }

  if (executorTrustLevel !== 'REAL_HIVE' && executorTrustLevel !== 'FAKE' && executorTrustLevel !== 'TEST') {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [
        {
          code: 'INVALID_EXECUTOR_TRUST_LEVEL',
          message: 'executorTrustLevel must be REAL_HIVE, FAKE, or TEST',
        },
      ],
    };
  }

  return runQualificationCommand(ctx, {
    packVersionId: packVersionId as PackVersionId,
    qualificationProfileId,
    qualificationProfileVersion,
    fixtureCorpusHash,
    executionRunId,
    executorTrustLevel,
    hiveVersion,
    executorVersion,
  });
}
