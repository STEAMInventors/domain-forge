import { describe, it, expect } from 'vitest';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { ForgeOrchestrator, PromptRegistry, executeStage } from '@domain-forge/orchestration';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import { HumanGateRequiredError } from '@domain-forge/core';
import defaultBudget from '../../configs/budgets/default.json';

describe('orchestration integration', () => {
  it('blocks stage execution without Stage 0 approval', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);

    const promptRegistry = new PromptRegistry();
    promptRegistry.register({
      id: 'example-neutral',
      version: '0.1.0',
      filePath: 'test',
      content: 'Input: {{input}}',
      contentHash: 'abc',
    });

    const modelProvider = new FakeModelProvider('fake', {
      default: JSON.stringify({
        schemaVersion: '0.1.0',
        observation: 'test',
        metricValue: 1,
        tags: [],
      }),
    });

    await expect(
      executeStage(
        { repos, promptRegistry, modelProvider, policyRegistry: createDefaultPolicyRegistry() },
        {
          run: { ...run, state: 'RUNNING' },
          definition: EXAMPLE_STAGE_DEFINITION,
          artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
          outputValidator: validateExampleStageOutput,
        },
      ),
    ).rejects.toThrow(HumanGateRequiredError);
  });

  it('allows stage execution after Stage 0 approval', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test-domain',
      packId: 'pack-001',
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

    const promptRegistry = new PromptRegistry();
    promptRegistry.register({
      id: 'example-neutral',
      version: '0.1.0',
      filePath: 'test',
      content: 'Input: {{input}}',
      contentHash: 'abc',
    });

    const modelProvider = new FakeModelProvider('fake', {
      default: JSON.stringify({
        schemaVersion: '0.1.0',
        observation: 'test',
        metricValue: 1,
        tags: [],
      }),
    });

    const updatedRun = (await repos.forgeRuns.get(run.id))!;
    const { execution, artifact } = await executeStage(
      { repos, promptRegistry, modelProvider, policyRegistry: createDefaultPolicyRegistry() },
      {
        run: updatedRun,
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidator: validateExampleStageOutput,
      },
    );

    expect(execution.status).toBe('COMPLETED');
    expect(artifact).toBeDefined();
    expect(artifact!.immutable).toBe(true);
  });
});
