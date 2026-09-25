import { join } from 'node:path';
import { ForgeOrchestrator, PromptRegistry, executeStage } from '@domain-forge/orchestration';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import { createPackVersion } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import type { ForgeRunId, HumanGateType, PackVersionId } from '@domain-forge/core';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import defaultBudget from '../../../../configs/budgets/default.json' with { type: 'json' };

export async function cmdCreateRun(
  ctx: CliContext,
  args: readonly string[],
): Promise<CommandResult> {
  const [domainId, packId, packVersion] = args;
  if (!domainId || !packId || !packVersion) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: create-run <domainId> <packId> <packVersion>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing create-run arguments' }],
    };
  }

  const orchestrator = new ForgeOrchestrator(ctx.repos);
  const run = await orchestrator.createRun({
    domainId,
    packId,
    packVersion,
    budget: defaultBudget,
  });

  const pack = createMinimalTestPack({ packId, packVersion, domainId });
  const packVer = createPackVersion(packId, packVersion, pack);
  await ctx.repos.packVersions.insert(packVer);

  return {
    exitCode: ExitCode.SUCCESS,
    summary: 'Forge run created',
    payload: { runId: run.id, packVersionId: packVer.id, state: run.state },
  };
}

export async function cmdInspectRun(
  ctx: CliContext,
  runId: string | undefined,
): Promise<CommandResult> {
  if (!runId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: inspect-run <runId>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing runId argument' }],
    };
  }

  const run = await ctx.repos.forgeRuns.get(runId as ForgeRunId);
  if (!run) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'FORGE_RUN_NOT_FOUND', message: `Unknown run ${runId}` }],
    };
  }

  const executions = await ctx.repos.stageExecutions.listByRun(run.id);
  const reviews = await ctx.repos.humanReviews.listByRun(run.id);
  const transitions = await ctx.repos.forgeRunTransitions.listByRun(run.id);

  return {
    exitCode: ExitCode.SUCCESS,
    payload: { run, executions, reviews, transitions },
  };
}

async function buildStageDeps(ctx: CliContext) {
  const promptRegistry = new PromptRegistry();
  await promptRegistry.loadFromDirectory(
    join(ctx.rootDir, 'prompts', 'example-neutral'),
    'example-neutral',
    '0.1.0',
    'template.md',
  );

  const modelProvider = new FakeModelProvider('fake', {
    default: JSON.stringify({
      schemaVersion: '0.1.0',
      observation: 'Neutral metric within expected range.',
      metricValue: 42,
      tags: ['synthetic', 'test'],
    }),
  });

  return {
    repos: ctx.repos,
    promptRegistry,
    modelProvider,
    policyRegistry: createDefaultPolicyRegistry(),
  };
}

export async function cmdExecuteStage(
  ctx: CliContext,
  runId: string | undefined,
): Promise<CommandResult> {
  if (!runId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: execute-stage <runId>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing runId argument' }],
    };
  }

  const orchestrator = new ForgeOrchestrator(ctx.repos);
  let run = await ctx.repos.forgeRuns.get(runId as ForgeRunId);
  if (!run) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'FORGE_RUN_NOT_FOUND', message: `Unknown run ${runId}` }],
    };
  }

  if (run.state === 'CREATED') {
    run = await orchestrator.startRun(run.id);
  }

  if (run.state !== 'RUNNING') {
    return {
      exitCode: ExitCode.BLOCKED_OR_REVIEW,
      summary: `Run is not executable in state ${run.state}`,
      payload: { runId: run.id, state: run.state },
      errors: [{ code: 'FORGE_RUN_NOT_RUNNING', message: `Run state is ${run.state}` }],
    };
  }

  const deps = await buildStageDeps(ctx);
  const outcome = await executeStage(deps, {
    run,
    definition: EXAMPLE_STAGE_DEFINITION,
    artifacts: {
      'seed-input': {
        content: { seedValue: 10, label: 'test-seed' },
      },
    },
    outputValidators: [validateExampleStageOutput],
  });

  const applied = await orchestrator.applyStageOutcome(run.id, outcome);
  let finalRun = applied.run;

  if (outcome.kind === 'SUCCEEDED') {
    finalRun = await orchestrator.completeRun(run.id);
  }

  const exitCode =
    outcome.kind === 'SUCCEEDED'
      ? ExitCode.SUCCESS
      : outcome.kind === 'HUMAN_REVIEW_REQUIRED' || outcome.kind === 'BLOCKED'
        ? ExitCode.BLOCKED_OR_REVIEW
        : ExitCode.VALIDATION_FAILURE;

  return {
    exitCode,
    summary: `Stage outcome: ${outcome.kind}`,
    payload: {
      runId: finalRun.id,
      runState: finalRun.state,
      outcomeKind: outcome.kind,
      outcome,
    },
  };
}

export async function cmdResumeRun(
  ctx: CliContext,
  runId: string | undefined,
): Promise<CommandResult> {
  if (!runId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: resume-run <runId>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing runId argument' }],
    };
  }

  const orchestrator = new ForgeOrchestrator(ctx.repos);
  const existing = await ctx.repos.forgeRuns.get(runId as ForgeRunId);
  if (!existing) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [{ code: 'FORGE_RUN_NOT_FOUND', message: `Unknown run ${runId}` }],
    };
  }

  try {
    const run = await orchestrator.resumeRun(runId as ForgeRunId);
    return {
      exitCode: ExitCode.SUCCESS,
      summary: 'Forge run resumed',
      payload: run,
    };
  } catch (error) {
    return {
      exitCode: ExitCode.VALIDATION_FAILURE,
      summary: 'Illegal resume transition',
      errors: [
        {
          code: 'ILLEGAL_FORGE_RUN_TRANSITION',
          message: error instanceof Error ? error.message : 'Resume rejected',
        },
      ],
    };
  }
}

export async function cmdRecordGate(
  ctx: CliContext,
  args: readonly string[],
): Promise<CommandResult> {
  const [runId, gateType, reviewerId] = args;
  if (!runId || !gateType || !reviewerId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: record-gate <runId> <gateType> <reviewerId>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing record-gate arguments' }],
    };
  }

  const orchestrator = new ForgeOrchestrator(ctx.repos);
  const record = await orchestrator.recordHumanGate({
    forgeRunId: runId as ForgeRunId,
    gateType: gateType as HumanGateType,
    reviewerId,
    reviewerRole: 'architect',
    decision: 'APPROVED',
    notes: 'CLI-recorded approval',
  });

  return {
    exitCode: ExitCode.SUCCESS,
    summary: 'Human gate recorded',
    payload: record,
  };
}

export async function cmdInspectPack(
  ctx: CliContext,
  packVersionId: string | undefined,
): Promise<CommandResult> {
  if (!packVersionId) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: inspect-pack <packVersionId>',
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

  const qualifications = await ctx.repos.qualifications.listByPack(pack.packId);
  const certifications = await ctx.repos.certifications.listByPack(pack.packId);
  const transitions = await ctx.repos.packVersionTransitions.listByPackVersion(pack.id);

  return {
    exitCode: ExitCode.SUCCESS,
    payload: {
      packVersion: pack,
      qualifications: qualifications.map((record) => ({
        id: record.id,
        recordFingerprint: record.recordFingerprint,
        executedAt: record.executedAt,
        profileId: record.identity.qualificationProfileId,
        profileVersion: record.identity.qualificationProfileVersion,
      })),
      certifications: certifications.map((record) => ({
        id: record.id,
        recordFingerprint: record.recordFingerprint,
        decision: record.decision.kind,
      })),
      transitions,
    },
  };
}

export async function cmdInspectCorpus(
  ctx: CliContext,
  fixtureCorpusHash: string | undefined,
): Promise<CommandResult> {
  if (!fixtureCorpusHash) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: inspect-corpus <fixtureCorpusHash>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing fixtureCorpusHash argument' }],
    };
  }

  const reference = await ctx.repos.fixtureCorpusReferences.getByHash(fixtureCorpusHash);
  if (!reference) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      errors: [
        {
          code: 'FIXTURE_CORPUS_NOT_FOUND',
          message: `No fixture corpus registered for hash ${fixtureCorpusHash}`,
        },
      ],
    };
  }

  return {
    exitCode: ExitCode.SUCCESS,
    payload: {
      fixtureCorpusHash: reference.fixtureCorpusHash,
      persistedAt: reference.persistedAt,
      corpusId: reference.corpus.corpus.corpusId,
      domainId: reference.corpus.corpus.domainId,
      fixtureCount:
        reference.corpus.corpus.standaloneFixtures.length +
        reference.corpus.corpus.cases.reduce((count, testCase) => count + testCase.fixtures.length, 0),
    },
  };
}
