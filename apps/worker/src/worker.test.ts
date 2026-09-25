import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import type { ForgeRepositories } from '@domain-forge/persistence';
import { ForgeOrchestrator, PromptRegistry, executeStage, runStageAcceptanceBoundary } from '@domain-forge/orchestration';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import defaultBudget from '../../../configs/budgets/default.json' with { type: 'json' };
import { processForgeRunOnce } from './run-processor.js';

const ROOT = join(import.meta.dirname, '../../..');

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

function validModelProvider(): FakeModelProvider {
  return new FakeModelProvider('fake', {
    default: JSON.stringify({
      schemaVersion: '0.1.0',
      observation: 'test',
      metricValue: 1,
      tags: [],
    }),
  });
}

describe('worker run processor', () => {
  let repos: ForgeRepositories;
  let orchestrator: ForgeOrchestrator;

  beforeEach(() => {
    repos = createInMemoryRepositories();
    orchestrator = new ForgeOrchestrator(repos);
  });

  it('transitions CREATED to RUNNING', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });

    const result = await processForgeRunOnce(repos, run, { rootDir: ROOT });
    expect(result.runState).toBe('RUNNING');
    expect(result.action).toBe('started');
  });

  it('persists accepted artifact on successful stage execution', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-002',
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
    const result = await processForgeRunOnce(repos, active, {
      rootDir: ROOT,
      allowRunningRecovery: true,
    });

    expect(result.outcomeKind).toBe('SUCCEEDED');
    const artifacts = await repos.artifacts.listByRun(run.id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.immutable).toBe(true);
  });

  it('rejects invalid proposed artifact without persisting accepted artifact', async () => {
    const metadata = {
      requestHash: 'req',
      responseHash: 'resp',
      provider: 'fake',
      modelIdentifier: 'm',
      tokenUsage: { input: 1, output: 1, total: 2 },
      invokedAt: '2026-01-01T00:00:00.000Z',
    };
    const acceptance = runStageAcceptanceBoundary(
      {
        source: 'MODEL',
        rawText: 'not-json',
        modelExecution: metadata,
        rawResponseHash: 'resp',
      },
      [validateExampleStageOutput],
      1,
    );
    expect(acceptance.status).toBe('VALIDATION_FAILED');

    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-003',
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
    expect(await repos.artifacts.listByRun(run.id)).toHaveLength(0);
    expect(await repos.proposedArtifacts.listByRun(run.id)).toHaveLength(0);
  });

  it('transitions to WAITING_FOR_HUMAN when human review is required', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-004',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);

    const outcome = await executeStage(
      {
        repos,
        promptRegistry: setupPromptRegistry(),
        modelProvider: validModelProvider(),
        policyRegistry: createDefaultPolicyRegistry(),
      },
      {
        run: (await repos.forgeRuns.get(run.id))!,
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    const applied = await orchestrator.applyStageOutcome(run.id, outcome);
    expect(applied.run.state).toBe('WAITING_FOR_HUMAN');
  });

  it('transitions blocked stage to BLOCKED', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-005',
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
        modelProvider: validModelProvider(),
        policyRegistry: createDefaultPolicyRegistry(),
      },
      {
        run: (await repos.forgeRuns.get(run.id))!,
        definition: {
          ...EXAMPLE_STAGE_DEFINITION,
          inputArtifactTypes: ['missing-artifact'],
        },
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    const applied = await orchestrator.applyStageOutcome(run.id, outcome);
    expect(outcome.kind).toBe('BLOCKED');
    expect(applied.run.state).toBe('BLOCKED');
  });

  it('transitions unrecoverable failure to FAILED', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-006',
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

    const applied = await orchestrator.applyStageOutcome(run.id, outcome);
    expect(applied.run.state).toBe('FAILED');
  });

  it('completes run after successful stage execution', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-007',
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
    const result = await processForgeRunOnce(repos, active, {
      rootDir: ROOT,
      allowRunningRecovery: true,
    });

    expect(result.runState).toBe('COMPLETED');
  });

  it('resumes from WAITING_FOR_HUMAN after gate approval', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-008',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.waitForHuman(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'reviewer-001',
      reviewerRole: 'architect',
      decision: 'APPROVED',
    });

    const resumed = await repos.forgeRuns.get(run.id);
    expect(resumed!.state).toBe('RUNNING');
  });

  it('rejects illegal resume transition', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-009',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);

    await expect(orchestrator.resumeRun(run.id)).rejects.toThrow();
  });

  it('persists transition records', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-010',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    const transitions = await repos.forgeRunTransitions.listByRun(run.id);
    expect(transitions.some((record) => record.action === 'START')).toBe(true);
  });

  it('skips duplicate stage execution when artifact already accepted', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-011',
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
    const artifactsBefore = await repos.artifacts.listByRun(run.id);
    await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: true,
    });
    const artifactsAfter = await repos.artifacts.listByRun(run.id);
    expect(artifactsAfter).toHaveLength(artifactsBefore.length);
  });

  it('does not auto-recover RUNNING runs without explicit allowance', async () => {
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-worker-012',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);

    const result = await processForgeRunOnce(repos, (await repos.forgeRuns.get(run.id))!, {
      rootDir: ROOT,
      allowRunningRecovery: false,
    });
    expect(result.action).toBe('skipped');
    expect(result.runState).toBe('RUNNING');
  });
});
