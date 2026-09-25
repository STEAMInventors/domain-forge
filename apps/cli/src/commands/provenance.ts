import { computePackContentHash } from '@hive/pack-contract';
import { createPackStatusResolver } from '@domain-forge/persistence';
import type { PackVersionId } from '@domain-forge/core';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';

export async function cmdProvenance(
  ctx: CliContext,
  packVersionId: string | undefined,
): Promise<CommandResult> {
  if (!packVersionId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: provenance <packVersionId>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing packVersionId argument' }],
    };
  }

  const pack = await ctx.repos.packVersions.get(packVersionId as PackVersionId);
  if (!pack) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'PACK_VERSION_NOT_FOUND', message: `Unknown pack version ${packVersionId}` }],
    };
  }

  const statusResolver = createPackStatusResolver(ctx.repos);
  const status = await statusResolver.resolve(pack.id);
  const certs = await ctx.repos.certifications.listByPack(pack.packId);
  const hash = computePackContentHash(pack.packContent);

  return {
    exitCode: ExitCode.SUCCESS,
    payload: {
      packId: pack.packId,
      packVersion: pack.version,
      packContentHash: hash,
      authorityCorpusHash: pack.authorityCorpusHash,
      lifecycleState: status?.lifecycleState ?? pack.state,
      certificationRecord: status?.certificationRecord
        ? {
            id: status.certificationRecord.id,
            recordFingerprint: status.certificationRecord.recordFingerprint,
            decision: status.certificationRecord.decision.kind,
          }
        : undefined,
      certifications: certs.map((record) => ({
        id: record.id,
        recordFingerprint: record.recordFingerprint,
        decision: record.decision.kind,
      })),
    },
  };
}
