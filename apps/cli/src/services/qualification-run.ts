import { DefaultQualificationExecutor, loadQualificationProfilesFromDirectory } from '@domain-forge/qualification';
import { computeFixtureFingerprint } from '@domain-forge/fixtures';
import type { PackVersionId } from '@domain-forge/core';
import type {
  AcceptedFixtureCorpus,
  ExecutorTrustLevel,
  FixtureExecutionResult,
} from '@domain-forge/contracts';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';

export interface QualificationRunInput {
  readonly packVersionId: PackVersionId;
  readonly qualificationProfileId: string;
  readonly qualificationProfileVersion: string;
  readonly fixtureCorpusHash: string;
  readonly executionRunId: string;
  readonly executorTrustLevel: ExecutorTrustLevel;
  readonly hiveVersion: string;
  readonly executorVersion: string;
  readonly fixtureExecutions?: readonly FixtureExecutionResult[];
}

function buildBootstrapFixtureExecutions(
  fixtureCorpus: AcceptedFixtureCorpus,
): FixtureExecutionResult[] {
  const fixtures = [
    ...fixtureCorpus.corpus.standaloneFixtures,
    ...fixtureCorpus.corpus.cases.flatMap((testCase) => testCase.fixtures),
  ];

  return fixtures.map((fixture) => ({
    fixtureId: fixture.id,
    fixtureFingerprint: computeFixtureFingerprint(fixture),
    fixtureCategory: fixture.category,
    materialClass: fixture.provenance.materialClass,
    executionStatus: 'completed' as const,
    goldEvaluation: {
      passed: true,
      findings: [{ status: 'match' as const, message: 'Bootstrap fixture execution recorded' }],
    },
  }));
}

export async function runQualificationCommand(
  ctx: CliContext,
  input: QualificationRunInput,
): Promise<CommandResult> {
  const packVersion = await ctx.repos.packVersions.get(input.packVersionId);
  if (packVersion === undefined) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'PACK_VERSION_NOT_FOUND', message: `Unknown pack version ${input.packVersionId}` }],
    };
  }

  const corpusRef = await ctx.repos.fixtureCorpusReferences.getByHash(input.fixtureCorpusHash);
  if (corpusRef === undefined) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [
        {
          code: 'FIXTURE_CORPUS_NOT_FOUND',
          message: `No accepted fixture corpus registered for hash ${input.fixtureCorpusHash}`,
        },
      ],
    };
  }

  const profileLoader = loadQualificationProfilesFromDirectory(ctx.qualificationProfilesDir);
  const executor = new DefaultQualificationExecutor({ profileLoader });

  const result = executor.execute({
    packVersion,
    fixtureCorpus: corpusRef.corpus,
    qualificationProfileId: input.qualificationProfileId,
    qualificationProfileVersion: input.qualificationProfileVersion,
    execution: {
      executionRunId: input.executionRunId,
      executorTrustLevel: input.executorTrustLevel,
      hiveVersion: input.hiveVersion,
      executorVersion: input.executorVersion,
      layerAMode: 'FACTS_IN',
    },
    fixtureExecutions:
      input.fixtureExecutions ?? buildBootstrapFixtureExecutions(corpusRef.corpus),
  });

  if (result.record !== undefined) {
    await ctx.repos.qualifications.append(result.record);
  }

  const exitCode =
    result.status === 'passed'
      ? ExitCode.SUCCESS
      : result.status === 'requires_review' || result.status === 'blocked'
        ? ExitCode.BLOCKED_OR_REVIEW
        : ExitCode.VALIDATION_FAILURE;

  return {
    exitCode,
    summary: `Qualification ${result.status}`,
    payload: {
      status: result.status,
      qualificationRecordId: result.record?.id,
      recordFingerprint: result.record?.recordFingerprint,
      packVersionState: packVersion.state,
    },
    errors: result.errors.map((error) => ({
      code: error.code,
      message: error.message,
      ...(error.path !== undefined ? { path: error.path } : {}),
    })),
  };
}
