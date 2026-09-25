import {
  asForgeRunId,
  asPackId,
  asPackVersionId,
  asHumanReviewId,
  emptyBudgetUsage,
  type ForgeRunId,
  type ForgeRunTransitionAction,
  type ForgeRunTransitionRecord,
} from '@domain-forge/core';
import type { ForgeRun, StageExecutionOutcome } from '@domain-forge/contracts';
import type { ForgeRepositories } from '@domain-forge/persistence';
import type { RunBudget } from '@domain-forge/core';
import type { HumanGateRecord } from '@domain-forge/core';
import { mapStageOutcomeToRunAction } from './stage-outcome-mapper.js';

export class ForgeOrchestrator {
  constructor(private readonly repos: ForgeRepositories) {}

  async createRun(opts: {
    domainId: string;
    packId: string;
    packVersion: string;
    budget: RunBudget;
  }): Promise<ForgeRun> {
    const now = new Date().toISOString();
    const run: ForgeRun = {
      id: asForgeRunId(`run-${Date.now()}`),
      packId: asPackId(opts.packId),
      packVersionId: asPackVersionId(`${opts.packId}-${opts.packVersion}`),
      domainId: opts.domainId,
      state: 'CREATED',
      budget: opts.budget,
      budgetUsage: emptyBudgetUsage(),
      createdAt: now,
      updatedAt: now,
    };
    await this.repos.forgeRuns.insert(run);
    return run;
  }

  private async applyRunTransition(
    run: ForgeRun,
    action: ForgeRunTransitionAction,
    context?: { actorRef?: string; reasonRef?: string },
  ): Promise<{ run: ForgeRun; record: ForgeRunTransitionRecord }> {
    const result = await this.repos.forgeRunLifecycle.applyTransition({
      forgeRunId: run.id,
      action,
      expectedFromState: run.state,
      ...(context !== undefined ? { context } : {}),
    });
    return result;
  }

  async startRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const { run: updated } = await this.applyRunTransition(run, 'START');
    return updated;
  }

  async completeRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const { run: updated } = await this.applyRunTransition(run, 'COMPLETE');
    return updated;
  }

  async failRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const { run: updated } = await this.applyRunTransition(run, 'FAIL');
    return updated;
  }

  async blockRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const { run: updated } = await this.applyRunTransition(run, 'BLOCK');
    return updated;
  }

  async waitForHuman(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const { run: updated } = await this.applyRunTransition(run, 'AWAIT_HUMAN');
    return updated;
  }

  async resumeRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const { run: updated } = await this.applyRunTransition(run, 'RESUME');
    return updated;
  }

  async recordHumanGate(record: Omit<HumanGateRecord, 'id' | 'timestamp'> & { id?: string }): Promise<HumanGateRecord> {
    const full: HumanGateRecord = {
      ...record,
      id: asHumanReviewId(record.id ?? `review-${Date.now()}`),
      timestamp: new Date().toISOString(),
    };
    await this.repos.humanReviews.save(full);

    if (full.gateType === 'STAGE_0_APPROVAL' && full.decision === 'APPROVED') {
      const run = await this.repos.forgeRuns.get(full.forgeRunId);
      if (run && run.state === 'WAITING_FOR_HUMAN') {
        await this.resumeRun(full.forgeRunId);
      }
    }

    return full;
  }

  async getRun(runId: ForgeRunId): Promise<ForgeRun | undefined> {
    return this.repos.forgeRuns.get(runId);
  }

  /**
   * Interprets a stage outcome and applies a ForgeRun lifecycle transition when appropriate.
   * Stages return typed outcomes; lifecycle mutation stays in the orchestrator.
   */
  async applyStageOutcome(
    runId: ForgeRunId,
    outcome: StageExecutionOutcome,
  ): Promise<{ run: ForgeRun; outcome: StageExecutionOutcome }> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const action = mapStageOutcomeToRunAction(outcome);
    if (action === null || run.state !== 'RUNNING') {
      return { run, outcome };
    }

    const { run: updated } = await this.applyRunTransition(run, action);
    return { run: updated, outcome };
  }
}
