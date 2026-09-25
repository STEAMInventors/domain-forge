import { ForgeOrchestrator } from '@domain-forge/orchestration';
import type { ForgeRun, StageExecutionOutcome } from '@domain-forge/contracts';
import type { ForgeRepositories } from '@domain-forge/persistence';
import { isForgeRunTerminal } from '@domain-forge/core';
import { createBootstrapStageDeps, executeBootstrapStage } from './stage-setup.js';

export interface ProcessRunOptions {
  readonly rootDir: string;
  readonly allowRunningRecovery?: boolean;
}

export interface ProcessRunResult {
  readonly runId: string;
  readonly action: 'skipped' | 'started' | 'executed' | 'resumed' | 'completed' | 'failed';
  readonly runState: string;
  readonly outcomeKind?: StageExecutionOutcome['kind'];
}

async function hasCompletedStageExecution(
  repos: ForgeRepositories,
  run: ForgeRun,
  stageId: string,
): Promise<boolean> {
  const executions = await repos.stageExecutions.listByRun(run.id);
  return executions.some(
    (execution) => execution.stageId === stageId && execution.status === 'COMPLETED',
  );
}

export async function processForgeRunOnce(
  repos: ForgeRepositories,
  run: ForgeRun,
  options: ProcessRunOptions,
): Promise<ProcessRunResult> {
  const orchestrator = new ForgeOrchestrator(repos);

  if (isForgeRunTerminal(run.state)) {
    return { runId: run.id, action: 'skipped', runState: run.state };
  }

  if (run.state === 'WAITING_FOR_HUMAN' || run.state === 'BLOCKED') {
    return { runId: run.id, action: 'skipped', runState: run.state };
  }

  let activeRun = run;

  if (activeRun.state === 'CREATED') {
    activeRun = await orchestrator.startRun(activeRun.id);
    return { runId: activeRun.id, action: 'started', runState: activeRun.state };
  }

  if (activeRun.state === 'RUNNING') {
    if (!options.allowRunningRecovery) {
      return { runId: run.id, action: 'skipped', runState: run.state };
    }
    const stageId = 'example-neutral';
    if (await hasCompletedStageExecution(repos, activeRun, stageId)) {
      const refreshed = (await repos.forgeRuns.get(activeRun.id))!;
      if (refreshed.state === 'RUNNING') {
        activeRun = await orchestrator.completeRun(activeRun.id);
        return {
          runId: activeRun.id,
          action: 'completed',
          runState: activeRun.state,
          outcomeKind: 'SUCCEEDED',
        };
      }
      return { runId: refreshed.id, action: 'skipped', runState: refreshed.state };
    }

    const deps = await createBootstrapStageDeps(repos, options.rootDir);
    const outcome = await executeBootstrapStage(deps, activeRun);
    const applied = await orchestrator.applyStageOutcome(activeRun.id, outcome);

    if (outcome.kind === 'SUCCEEDED') {
      activeRun = await orchestrator.completeRun(activeRun.id);
      return {
        runId: activeRun.id,
        action: 'completed',
        runState: activeRun.state,
        outcomeKind: outcome.kind,
      };
    }

    return {
      runId: applied.run.id,
      action:
        outcome.kind === 'VALIDATION_FAILED' || outcome.kind === 'RUNTIME_FAILED'
          ? 'failed'
          : 'executed',
      runState: applied.run.state,
      outcomeKind: outcome.kind,
    };
  }

  return { runId: activeRun.id, action: 'skipped', runState: activeRun.state };
}

export async function processAllForgeRunsOnce(
  repos: ForgeRepositories,
  options: ProcessRunOptions,
): Promise<ProcessRunResult[]> {
  const runs = await repos.forgeRuns.list();
  const results: ProcessRunResult[] = [];

  for (const run of runs) {
    results.push(await processForgeRunOnce(repos, run, options));
  }

  return results;
}
