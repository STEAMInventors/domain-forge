import { evaluateRuntimeEligibility } from '@domain-forge/certification';
import {
  createExtractionQualificationResolver,
  createPackStatusResolver,
} from '@domain-forge/persistence';
import { DefaultQualificationStalenessEvaluator } from '@domain-forge/qualification';
import type { PackVersionId, QualificationRecordId } from '@domain-forge/core';
import type {
  RuntimeCapability,
  RuntimeEligibilityDecision,
} from '@domain-forge/contracts';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import { resolveDependencyEligibility } from './dependency-eligibility.js';

export interface RuntimeEligibilityCheckInput {
  readonly packVersionId: PackVersionId;
  readonly qualificationRecordId?: QualificationRecordId;
  readonly hiveVersion: string;
  readonly suppliedCapabilities: readonly RuntimeCapability[];
  readonly extractionModelFamily?: string;
  readonly extractionModelVersion?: string;
  readonly extractionPolicyVersion?: string;
}

export async function checkRuntimeEligibility(
  ctx: CliContext,
  input: RuntimeEligibilityCheckInput,
): Promise<CommandResult> {
  const packVersion = await ctx.repos.packVersions.get(input.packVersionId);
  if (packVersion === undefined) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Pack version not found',
      errors: [{ code: 'PACK_VERSION_NOT_FOUND', message: `Unknown pack version ${input.packVersionId}` }],
    };
  }

  const statusResolver = createPackStatusResolver(ctx.repos);
  const status = await statusResolver.resolve(input.packVersionId);

  let currentQualificationRecord = undefined as
    | Awaited<ReturnType<typeof ctx.repos.qualifications.get>>
    | undefined;

  if (input.qualificationRecordId !== undefined) {
    currentQualificationRecord = await ctx.repos.qualifications.get(input.qualificationRecordId);
    if (currentQualificationRecord === undefined) {
      return {
        exitCode: ExitCode.USAGE_OR_CONFIG,
        summary: 'Qualification record not found',
        errors: [
          {
            code: 'QUALIFICATION_RECORD_NOT_FOUND',
            message: `Unknown qualification record ${input.qualificationRecordId}`,
          },
        ],
      };
    }
  }

  const dependencyResult = await resolveDependencyEligibility(ctx.repos, packVersion, {
    suppliedCapabilities: input.suppliedCapabilities,
    hiveVersion: input.hiveVersion,
  });

  if (dependencyResult.errors.length > 0) {
    return {
      exitCode: ExitCode.VALIDATION_FAILURE,
      summary: 'Dependency resolution failed',
      errors: dependencyResult.errors,
    };
  }

  const extractionResolver = createExtractionQualificationResolver(ctx.repos, {
    qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
  });

  if (
    input.extractionModelFamily !== undefined &&
    input.extractionModelVersion !== undefined &&
    input.extractionPolicyVersion !== undefined
  ) {
    const extractionResolution = await extractionResolver.resolve(
      packVersion.packId,
      packVersion.packContentHash,
      {
        hiveVersion: input.hiveVersion,
        extractionModelFamily: input.extractionModelFamily,
        extractionModelVersion: input.extractionModelVersion,
        extractionPolicyVersion: input.extractionPolicyVersion,
      },
    );

    if (
      extractionResolution !== undefined &&
      extractionResolution.qualificationRecord !== undefined &&
      currentQualificationRecord === undefined
    ) {
      currentQualificationRecord = extractionResolution.qualificationRecord;
    }
  }

  const decision: RuntimeEligibilityDecision = evaluateRuntimeEligibility(
    packVersion,
    status?.certificationRecord,
    {
      suppliedCapabilities: input.suppliedCapabilities,
      hiveVersion: input.hiveVersion,
      ...(input.extractionModelFamily !== undefined
        ? { extractionModelFamily: input.extractionModelFamily }
        : {}),
      ...(input.extractionModelVersion !== undefined
        ? { extractionModelVersion: input.extractionModelVersion }
        : {}),
      ...(input.extractionPolicyVersion !== undefined
        ? { extractionPolicyVersion: input.extractionPolicyVersion }
        : {}),
      ...(dependencyResult.map.size > 0 ? { dependencyEligibility: dependencyResult.map } : {}),
      ...(currentQualificationRecord !== undefined
        ? { currentQualificationRecord }
        : {}),
      qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
    },
  );

  return {
    exitCode: decision.status === 'eligible' ? ExitCode.SUCCESS : ExitCode.VALIDATION_FAILURE,
    summary:
      decision.status === 'eligible'
        ? 'Pack version is runtime eligible'
        : 'Pack version is runtime ineligible',
    payload: {
      packVersionId: input.packVersionId,
      lifecycleState: packVersion.state,
      decision,
    },
    ...(decision.status !== 'eligible'
      ? {
          errors: decision.reasons.map((reason) => ({
            code: reason.code,
            message: reason.message,
            ...(reason.context !== undefined ? { context: reason.context } : {}),
          })),
        }
      : {}),
  };
}
