import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import type { ForgeRepositories } from '@domain-forge/persistence';
import {
  ForgeOrchestrator,
  PromptRegistry,
  executeStage,
  runStageAcceptanceBoundary,
} from '@domain-forge/orchestration';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import defaultBudget from '../../configs/budgets/default.json' with { type: 'json' };
import { processForgeRunOnce } from '../../apps/worker/src/run-processor.js';

const ROOT = join(import.meta.dirname, '../..');

function setupPromptRegistry(): PromptRegistry {
  const promptRegistry = new PromptRegistry();
  promptRegistry.register({
    id: 'example-neutral',
    version: '0.1.0',
    filePath: 'test',
    content: 'Input: {{input}}',
    contentHash: 'abc',
  });
  return promptRegistry;
}

describe('adversarial: worker run processor', () => {
  let repos: ForgeRepositories;
  let orchestrator: ForgeOrchestrator;

  beforeEach(() => {
    repos = createInMemoryRepositories();
    orchestrator = new ForgeOrchestrator(repos);
  });

  it('skips duplicate processing of CREATED run without double-start corruption', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });

    const first = await processForgeRunOnce(repos, run, { rootDir: ROOT });
    expect(first.action).toBe('started');
    expect(first.runState).toBe('RUNNING');

    const second = await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: false,
    });
    expect(second.action).toBe('skipped');
    expect(second.runState).toBe('RUNNING');
  });

  it('does not process RUNNING job twice without allowRunningRecovery', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-002',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);

    const result = await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: false,
    });
    expect(result.action).toBe('skipped');
  });

  it('skips stage when accepted artifact already exists', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-003',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'reviewer-001',
      reviewerRole: 'architect',
      decision: 'APPROVED',
    });

    const active = (await repos.forgeRuns.get(run.id))!;
    await processForgeRunOnce(repos, active, { rootDir: ROOT, allowRunningRecovery: true });
    const countBefore = (await repos.artifacts.listByRun(run.id)).length;
    await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: true,
    });
    expect((await repos.artifacts.listByRun(run.id)).length).toBe(countBefore);
  });

  it('does not continue from BLOCKED without explicit resume', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-004',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.blockRun(run.id);

    const result = await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: true,
    });
    expect(result.action).toBe('skipped');
    expect(result.runState).toBe('BLOCKED');
  });

  it('does not continue from WAITING_FOR_HUMAN without gate approval', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-005',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.waitForHuman(run.id);

    const result = await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: true,
    });
    expect(result.action).toBe('skipped');
    expect(result.runState).toBe('WAITING_FOR_HUMAN');
  });

  it('rejects malformed stage proposal at acceptance boundary', () => {
    const acceptance = runStageAcceptanceBoundary(
      {
        source: 'MODEL',
        rawText: '{ invalid json',
        modelExecution: {
          requestHash: 'req',
          responseHash: 'resp',
          provider: 'fake',
          modelIdentifier: 'm',
          tokenUsage: { input: 1, output: 1, total: 2 },
          invokedAt: '2026-01-01T00:00:00.000Z',
        },
        rawResponseHash: 'resp',
      },
      [validateExampleStageOutput],
      1,
    );
    expect(acceptance.status).toBe('VALIDATION_FAILED');
    expect(acceptance.accepted).toBeUndefined();
  });

  it('transitions to FAILED on unrecoverable validation failure without persisting accepted artifact', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-006',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'reviewer-001',
      reviewerRole: 'architect',
      decision: 'APPROVED',
    });

    const outcome = await executeStage(
      {
        repos,
        promptRegistry: setupPromptRegistry(),
        modelProvider: new FakeModelProvider('fake', { default: 'not-json' }),
        policyRegistry: createDefaultPolicyRegistry(),
      },
      {
        run: (await repos.forgeRuns.get(run.id))!,
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    await orchestrator.applyStageOutcome(run.id, outcome);
    expect(outcome.kind).toBe('VALIDATION_FAILED');
    expect((await repos.forgeRuns.get(run.id))!.state).toBe('FAILED');
    expect(await repos.artifacts.listByRun(run.id)).toHaveLength(0);
  });

  it('rejects illegal resume from RUNNING without human gate', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-adv-007',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await expect(orchestrator.resumeRun(run.id)).rejects.toThrow();
  });
});
