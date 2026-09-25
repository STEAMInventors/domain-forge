import { describe, it, expect } from 'vitest';
import type { StageExecutionOutcome } from '@domain-forge/contracts';
import { STAGE_ERROR_CODES } from '@domain-forge/contracts';
import { mapStageOutcomeToRunAction } from '@domain-forge/orchestration';
import { ForgeOrchestrator } from '@domain-forge/orchestration';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { asForgeRunId, asPackId, asPackVersionId } from '@domain-forge/core';

const frozenContext = Object.freeze({
  forgeRunId: asForgeRunId('run-arch'),
  packId: asPackId('pack-arch'),
  packVersionId: asPackVersionId('pack-arch-0.1.0'),
  stageIdentity: Object.freeze({ stageId: 'example', definitionVersion: '0.1.0' }),
  projectedInput: Object.freeze({ seedValue: 1 }),
  projectedInputHash: 'hash',
  dependencyArtifacts: Object.freeze([]),
  configRefs: Object.freeze([]),
  initiatedAt: '2026-01-01T00:00:00.000Z',
});

function assertExhaustiveOutcome(outcome: StageExecutionOutcome): string {
  switch (outcome.kind) {
    case 'SUCCEEDED':
      return 'succeeded';
    case 'VALIDATION_FAILED':
      return 'validation_failed';
    case 'HUMAN_REVIEW_REQUIRED':
      return 'human_review';
    case 'BLOCKED':
      return 'blocked';
    case 'INVALID_INPUT':
      return 'invalid_input';
    case 'RUNTIME_FAILED':
      return 'runtime_failed';
    default: {
      const _exhaustive: never = outcome;
      return _exhaustive;
    }
  }
}

describe('architecture: stage execution contracts', () => {
  it('defines discriminated outcomes without ambiguous success/error combinations', () => {
    const codes = new Set(STAGE_ERROR_CODES);
    expect(codes.has('INVALID_STAGE_INPUT')).toBe(true);
    expect(codes.has('HUMAN_REVIEW_REQUIRED')).toBe(true);
    expect(codes.has('DETERMINISTIC_VALIDATION_FAILED')).toBe(true);

    const successOutcome: StageExecutionOutcome = {
      kind: 'SUCCEEDED',
      context: frozenContext,
      execution: {
        id: 'exec-1' as never,
        forgeRunId: frozenContext.forgeRunId,
        stageId: 'example',
        stageDefinitionVersion: '0.1.0',
        attempts: [],
        status: 'COMPLETED',
        startedAt: frozenContext.initiatedAt,
      },
      attempt: {
        id: 'attempt-1' as never,
        attemptNumber: 1,
        projectedInput: {},
        projectedInputHash: 'hash',
        promptTemplateId: 'p',
        promptVersion: '0.1.0',
        promptFileHash: 'h',
        renderedInputHash: 'h',
        provider: 'fake',
        modelIdentifier: 'm',
        rawResponse: '{}',
        validationResults: [],
        evidenceReferences: [],
        toolInvocations: [],
        tokenUsage: { input: 0, output: 0, total: 0 },
        startedAt: frozenContext.initiatedAt,
        status: 'COMPLETED',
      },
      proposed: {
        source: 'MODEL',
        rawText: '{}',
        parsed: { ok: true },
        modelExecution: {
          requestHash: 'r',
          responseHash: 's',
          provider: 'fake',
          modelIdentifier: 'm',
          tokenUsage: { input: 0, output: 0, total: 0 },
          invokedAt: frozenContext.initiatedAt,
        },
        rawResponseHash: 's',
      },
      accepted: {
        source: 'VALIDATED',
        content: { ok: true },
        contentHash: 'content-hash',
        validationResults: [],
        proposedOutputRef: { rawResponseHash: 's', attemptNumber: 1 },
      },
      artifact: {
        id: 'art-1' as never,
        forgeRunId: frozenContext.forgeRunId,
        stageId: 'example',
        artifactType: 'neutral-observation',
        schemaVersion: '0.1.0',
        content: { ok: true },
        contentHash: 'content-hash',
        createdAt: frozenContext.initiatedAt,
        immutable: true,
      },
    };

    expect(assertExhaustiveOutcome(successOutcome)).toBe('succeeded');
    expect(mapStageOutcomeToRunAction(successOutcome)).toBeNull();
  });

  it('keeps lifecycle logic in orchestrator rather than stage contracts', async () => {
    const repos = createInMemoryRepositories();
    const orchestrator = new ForgeOrchestrator(repos);
    const run = await orchestrator.createRun({
      domainId: 'arch',
      packId: 'pack-001',
      packVersion: '0.1.0',
      budget: { maxModelInvocations: 10, maxTokens: 100000, maxCostUsd: 100 },
    });
    await orchestrator.startRun(run.id);

    const outcome: StageExecutionOutcome = {
      kind: 'HUMAN_REVIEW_REQUIRED',
      context: frozenContext,
      execution: {
        id: 'exec-1' as never,
        forgeRunId: run.id,
        stageId: 'example',
        stageDefinitionVersion: '0.1.0',
        attempts: [],
        status: 'NEEDS_REVIEW',
        startedAt: frozenContext.initiatedAt,
      },
      attempt: {
        id: 'attempt-1' as never,
        attemptNumber: 1,
        projectedInput: {},
        projectedInputHash: 'hash',
        promptTemplateId: 'p',
        promptVersion: '0.1.0',
        promptFileHash: 'h',
        renderedInputHash: 'h',
        provider: 'fake',
        modelIdentifier: 'm',
        rawResponse: '{}',
        validationResults: [],
        evidenceReferences: [],
        toolInvocations: [],
        tokenUsage: { input: 0, output: 0, total: 0 },
        startedAt: frozenContext.initiatedAt,
        status: 'NEEDS_REVIEW',
      },
      proposed: {
        source: 'MODEL',
        rawText: '{}',
        parsed: {},
        modelExecution: {
          requestHash: 'r',
          responseHash: 's',
          provider: 'fake',
          modelIdentifier: 'm',
          tokenUsage: { input: 0, output: 0, total: 0 },
          invokedAt: frozenContext.initiatedAt,
        },
        rawResponseHash: 's',
      },
      reviewReason: { code: 'HUMAN_REVIEW_REQUIRED', message: 'review' },
      validationResults: [],
    };

    expect(mapStageOutcomeToRunAction(outcome)).toBe('AWAIT_HUMAN');
    const applied = await orchestrator.applyStageOutcome(run.id, outcome);
    expect(applied.run.state).toBe('WAITING_FOR_HUMAN');
  });
});
