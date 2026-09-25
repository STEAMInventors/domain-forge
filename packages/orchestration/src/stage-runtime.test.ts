import { describe, it, expect } from 'vitest';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import type { ModelPolicy, ModelProvider, ModelRequest, ModelResponse } from '@domain-forge/contracts';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import { makeResult } from '@domain-forge/validation';
import { computePackContentHash } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';
import { ForgeOrchestrator, PromptRegistry, executeStage, runStageAcceptanceBoundary } from './index.js';
import defaultBudget from '../../../configs/budgets/default.json' with { type: 'json' };

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

describe('runStageAcceptanceBoundary', () => {
  const metadata = {
    requestHash: 'req',
    responseHash: 'resp',
    provider: 'fake',
    modelIdentifier: 'm',
    tokenUsage: { input: 1, output: 1, total: 2 },
    invokedAt: '2026-01-01T00:00:00.000Z',
  };

  it('rejects unparsed model output', () => {
    const result = runStageAcceptanceBoundary(
      {
        source: 'MODEL',
        rawText: 'not-json',
        modelExecution: metadata,
        rawResponseHash: 'resp',
      },
      [validateExampleStageOutput],
      1,
    );
    expect(result.status).toBe('VALIDATION_FAILED');
    if (result.status === 'VALIDATION_FAILED') {
      expect(result.failure.code).toBe('MODEL_OUTPUT_ERROR');
      expect(result.proposed.source).toBe('MODEL');
    }
  });

  it('accepts valid output through deterministic validation', () => {
    const parsed = {
      schemaVersion: '0.1.0',
      observation: 'ok',
      metricValue: 2,
      tags: [],
    };
    const result = runStageAcceptanceBoundary(
      {
        source: 'MODEL',
        rawText: JSON.stringify(parsed),
        parsed,
        modelExecution: metadata,
        rawResponseHash: 'resp',
      },
      [validateExampleStageOutput],
      1,
    );
    expect(result.status).toBe('ACCEPTED');
    if (result.status === 'ACCEPTED') {
      expect(result.accepted.source).toBe('VALIDATED');
      expect(result.accepted.content).toEqual(parsed);
      expect(result.proposed.parsed).toEqual(parsed);
    }
  });

  it('returns NEEDS_REVIEW without treating it as success', () => {
    const parsed = { schemaVersion: '0.1.0', observation: 'x', metricValue: 1, tags: [] };
    const result = runStageAcceptanceBoundary(
      {
        source: 'MODEL',
        rawText: JSON.stringify(parsed),
        parsed,
        modelExecution: metadata,
        rawResponseHash: 'resp',
      },
      [
        () =>
          makeResult('review-validator', '1.0.0', false, [
            { code: 'NEEDS_REVIEW', message: 'human required' },
          ]),
      ],
      1,
    );
    expect(result.status).toBe('NEEDS_REVIEW');
  });
});

describe('executeStage', () => {
  it('returns BLOCKED when Stage 0 approval is missing', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
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
        run: { ...run, state: 'RUNNING' },
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    expect(outcome.kind).toBe('BLOCKED');
  });

  it('returns INVALID_INPUT for projection violations', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'r1',
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
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'undeclared-artifact': { content: { foo: 'bar' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    expect(outcome.kind).toBe('INVALID_INPUT');
  });

  it('returns VALIDATION_FAILED for invalid model output', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'r1',
      reviewerRole: 'architect',
      decision: 'APPROVED',
    });

    const badProvider = new FakeModelProvider('fake', {
      default: JSON.stringify({ schemaVersion: '0.1.0', observation: 'bad' }),
    });

    const outcome = await executeStage(
      {
        repos,
        promptRegistry: setupPromptRegistry(),
        modelProvider: badProvider,
        policyRegistry: createDefaultPolicyRegistry(),
      },
      {
        run: (await repos.forgeRuns.get(run.id))!,
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    expect(outcome.kind).toBe('VALIDATION_FAILED');
    if (outcome.kind === 'VALIDATION_FAILED') {
      expect(outcome.proposed.source).toBe('MODEL');
      expect(outcome.failure.code).toBe('SCHEMA_VALIDATION_ERROR');
      const saved = await repos.stageExecutions.listByRun(run.id);
      expect(saved[0]?.outputArtifactId).toBeUndefined();
    }
  });

  it('returns SUCCEEDED with distinct proposed and accepted outputs', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'r1',
      reviewerRole: 'architect',
      decision: 'APPROVED',
    });

    const pack = createMinimalTestPack();
    const packContentHash = computePackContentHash(pack);
    const packSnapshot = structuredClone(pack);

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
        packContentHash,
        outputValidators: [validateExampleStageOutput],
      },
    );

    expect(outcome.kind).toBe('SUCCEEDED');
    if (outcome.kind === 'SUCCEEDED') {
      expect(outcome.proposed.source).toBe('MODEL');
      expect(outcome.accepted.source).toBe('VALIDATED');
      expect(outcome.context.packContentHash).toBe(packContentHash);
      expect(Object.isFrozen(outcome.context)).toBe(true);
      expect(pack).toEqual(packSnapshot);
    }
  });

  it('returns RUNTIME_FAILED when model provider throws', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'r1',
      reviewerRole: 'architect',
      decision: 'APPROVED',
    });

    const failingProvider: ModelProvider = {
      providerName: 'failing',
      getModelIdentity: (policy: ModelPolicy) => policy.modelIdentifier,
      invoke: async (_request: ModelRequest, _policy: ModelPolicy): Promise<ModelResponse> => {
        throw new Error('provider unavailable');
      },
    };

    const outcome = await executeStage(
      {
        repos,
        promptRegistry: setupPromptRegistry(),
        modelProvider: failingProvider,
        policyRegistry: createDefaultPolicyRegistry(),
      },
      {
        run: (await repos.forgeRuns.get(run.id))!,
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    expect(outcome.kind).toBe('RUNTIME_FAILED');
    if (outcome.kind === 'RUNTIME_FAILED') {
      expect(outcome.failure.code).toBe('MODEL_INVOCATION_ERROR');
    }
  });

  it('freezes execution context so stages cannot mutate projected input', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'r1',
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
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    if (outcome.kind === 'SUCCEEDED') {
      expect(() => {
        (outcome.context.projectedInput as Record<string, unknown>)['seedValue'] = 999;
      }).toThrow();
    }
  });

  it('does not expose contradictory success/error fields on outcomes', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);
    await orchestrator.recordHumanGate({
      forgeRunId: run.id,
      gateType: 'STAGE_0_APPROVAL',
      reviewerId: 'r1',
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
        definition: EXAMPLE_STAGE_DEFINITION,
        artifacts: { 'seed-input': { content: { seedValue: 1, label: 'x' } } },
        outputValidators: [validateExampleStageOutput],
      },
    );

    if (outcome.kind === 'SUCCEEDED') {
      expect('failure' in outcome).toBe(false);
      expect(outcome.artifact).toBeDefined();
    } else {
      expect(outcome.kind).not.toBe('SUCCEEDED');
    }
  });
});

describe('ForgeOrchestrator.applyStageOutcome', () => {
  it('centralizes lifecycle transitions from stage outcomes', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'test',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: defaultBudget,
    });
    await orchestrator.startRun(run.id);

    const blocked = await executeStage(
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

    const { run: waiting } = await orchestrator.applyStageOutcome(run.id, blocked);
    expect(waiting.state).toBe('WAITING_FOR_HUMAN');
  });
});
