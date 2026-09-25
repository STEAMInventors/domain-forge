import {
  asForgeRunId,
  asPackId,
  asPackVersionId,
  asHumanReviewId,
  transitionForgeRun,
  emptyBudgetUsage,
  type ForgeRunId,
} from '@domain-forge/core';
import type { ForgeRun } from '@domain-forge/contracts';
import type { ForgeRepositories } from '@domain-forge/persistence';
import type { RunBudget } from '@domain-forge/core';
import type { HumanGateRecord } from '@domain-forge/core';

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
    await this.repos.forgeRuns.save(run);
    return run;
  }

  async startRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const newState = transitionForgeRun(run.state, 'RUNNING');
    const updated = { ...run, state: newState, updatedAt: new Date().toISOString() };
    await this.repos.forgeRuns.save(updated);
    return updated;
  }

  async completeRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const newState = transitionForgeRun(run.state, 'COMPLETED');
    const now = new Date().toISOString();
    const updated = { ...run, state: newState, updatedAt: now, completedAt: now };
    await this.repos.forgeRuns.save(updated);
    return updated;
  }

  async failRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const newState = transitionForgeRun(run.state, 'FAILED');
    const now = new Date().toISOString();
    const updated = { ...run, state: newState, updatedAt: now, completedAt: now };
    await this.repos.forgeRuns.save(updated);
    return updated;
  }

  async blockRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const newState = transitionForgeRun(run.state, 'BLOCKED');
    const updated = { ...run, state: newState, updatedAt: new Date().toISOString() };
    await this.repos.forgeRuns.save(updated);
    return updated;
  }

  async waitForHuman(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const newState = transitionForgeRun(run.state, 'WAITING_FOR_HUMAN');
    const updated = { ...run, state: newState, updatedAt: new Date().toISOString() };
    await this.repos.forgeRuns.save(updated);
    return updated;
  }

  async resumeRun(runId: ForgeRunId): Promise<ForgeRun> {
    const run = await this.repos.forgeRuns.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    const newState = transitionForgeRun(run.state, 'RUNNING');
    const updated = { ...run, state: newState, updatedAt: new Date().toISOString() };
    await this.repos.forgeRuns.save(updated);
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
}
