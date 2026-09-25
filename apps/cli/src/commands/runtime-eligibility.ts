import type { PackVersionId, QualificationRecordId } from '@domain-forge/core';
import type { RuntimeCapability } from '@domain-forge/contracts';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import { checkRuntimeEligibility } from '../services/runtime-eligibility-check.js';

export async function cmdRuntimeEligibility(
  ctx: CliContext,
  args: readonly string[],
): Promise<CommandResult> {
  const [
    packVersionId,
    hiveVersion,
    suppliedCapabilitiesRaw,
    qualificationRecordId,
    extractionModelFamily,
    extractionModelVersion,
    extractionPolicyVersion,
  ] = args;

  if (!packVersionId || !hiveVersion) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary:
        'Usage: runtime-eligibility <packVersionId> <hiveVersion> [suppliedCapabilitiesCsv] [qualificationRecordId] [extractionModelFamily] [extractionModelVersion] [extractionPolicyVersion]',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing runtime-eligibility arguments' }],
    };
  }

  const suppliedCapabilities: RuntimeCapability[] = (suppliedCapabilitiesRaw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((entry) => {
      const [capabilityId, version = '1.0.0'] = entry.split(':');
      return { capabilityId: capabilityId!, version };
    });

  return checkRuntimeEligibility(ctx, {
    packVersionId: packVersionId as PackVersionId,
    hiveVersion,
    suppliedCapabilities,
    ...(qualificationRecordId !== undefined && qualificationRecordId.length > 0
      ? { qualificationRecordId: qualificationRecordId as QualificationRecordId }
      : {}),
    ...(extractionModelFamily !== undefined && extractionModelFamily.length > 0
      ? { extractionModelFamily }
      : {}),
    ...(extractionModelVersion !== undefined && extractionModelVersion.length > 0
      ? { extractionModelVersion }
      : {}),
    ...(extractionPolicyVersion !== undefined && extractionPolicyVersion.length > 0
      ? { extractionPolicyVersion }
      : {}),
  });
}
