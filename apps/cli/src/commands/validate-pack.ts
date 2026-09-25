import type { PackVersionId } from '@domain-forge/core';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import { runPackValidation } from '../services/pack-validation.js';

export async function cmdValidatePack(
  ctx: CliContext,
  packVersionId: string | undefined,
): Promise<CommandResult> {
  if (!packVersionId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: validate-pack <packVersionId>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing packVersionId argument' }],
    };
  }

  const packVersion = await ctx.repos.packVersions.get(packVersionId as PackVersionId);
  if (packVersion === undefined) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'PACK_VERSION_NOT_FOUND', message: `Unknown pack version ${packVersionId}` }],
    };
  }

  const validation = runPackValidation(packVersion.packContent);

  return {
    exitCode: validation.passed ? ExitCode.SUCCESS : ExitCode.VALIDATION_FAILURE,
    summary: validation.passed ? 'Pack validation passed' : 'Pack validation failed',
    payload: {
      packVersionId,
      packContentHash: packVersion.packContentHash,
      validation,
    },
    ...(validation.passed
      ? {}
      : {
          errors: validation.results.flatMap((result) =>
            result.errors.map((error) => ({
              code: error.code,
              message: error.message,
              ...(error.path !== undefined ? { path: error.path } : {}),
            })),
          ),
        }),
  };
}
