import { describe, it, expect } from 'vitest';
import { mapStageOutcomeToRunAction } from './stage-outcome-mapper.js';
import type { StageExecutionOutcome } from '@domain-forge/contracts';
import { asForgeRunId, asPackId, asPackVersionId } from '@domain-forge/core';

const baseContext = {
  forgeRunId: asForgeRunId('run-1'),
  packId: asPackId('pack-1'),
  packVersionId: asPackVersionId('pack-1-0.1.0'),
  stageIdentity: { stageId: 'example', definitionVersion: '0.1.0' },
  projectedInput: {},
  projectedInputHash: 'hash',
  dependencyArtifacts: [],
  configRefs: [],
  initiatedAt: '2026-01-01T00:00:00.000Z',
} as const;

function blockedOutcome(code: 'HUMAN_GATE_REQUIRED' | 'BLOCKED_PREREQUISITE'): StageExecutionOutcome {
  return {
    kind: 'BLOCKED',
    context: baseContext,
    failure: { code, message: 'blocked' },
  };
}

describe('mapStageOutcomeToRunAction', () => {
  it('maps human review to AWAIT_HUMAN', () => {
    const outcome: StageExecutionOutcome = {
      kind: 'HUMAN_REVIEW_REQUIRED',
      context: baseContext,
      execution: {
        id: 'exec-1' as never,
        forgeRunId: baseContext.forgeRunId,
        stageId: 'example',
        stageDefinitionVersion: '0.1.0',
        attempts: [],
        status: 'NEEDS_REVIEW',
        startedAt: baseContext.initiatedAt,
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
        startedAt: baseContext.initiatedAt,
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
          invokedAt: baseContext.initiatedAt,
        },
        rawResponseHash: 's',
      },
      reviewReason: { code: 'HUMAN_REVIEW_REQUIRED', message: 'review' },
      validationResults: [],
    };

    expect(mapStageOutcomeToRunAction(outcome)).toBe('AWAIT_HUMAN');
  });

  it('maps validation and runtime failures to FAIL', () => {
    expect(
      mapStageOutcomeToRunAction({
        kind: 'VALIDATION_FAILED',
        context: baseContext,
        execution: {
          id: 'exec-1' as never,
          forgeRunId: baseContext.forgeRunId,
          stageId: 'example',
          stageDefinitionVersion: '0.1.0',
          attempts: [],
          status: 'FAILED',
          startedAt: baseContext.initiatedAt,
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
          startedAt: baseContext.initiatedAt,
          status: 'FAILED',
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
            invokedAt: baseContext.initiatedAt,
          },
          rawResponseHash: 's',
        },
        failure: { code: 'SCHEMA_VALIDATION_ERROR', message: 'bad schema' },
        validationResults: [],
      }),
    ).toBe('FAIL');
  });

  it('maps blocked human gate to AWAIT_HUMAN and other blocked to BLOCK', () => {
    expect(mapStageOutcomeToRunAction(blockedOutcome('HUMAN_GATE_REQUIRED'))).toBe('AWAIT_HUMAN');
    expect(mapStageOutcomeToRunAction(blockedOutcome('BLOCKED_PREREQUISITE'))).toBe('BLOCK');
  });

  it('returns null for success', () => {
    expect(
      mapStageOutcomeToRunAction({
        kind: 'SUCCEEDED',
        context: baseContext,
        execution: {
          id: 'exec-1' as never,
          forgeRunId: baseContext.forgeRunId,
          stageId: 'example',
          stageDefinitionVersion: '0.1.0',
          attempts: [],
          status: 'COMPLETED',
          startedAt: baseContext.initiatedAt,
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
          startedAt: baseContext.initiatedAt,
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
            invokedAt: baseContext.initiatedAt,
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
          forgeRunId: baseContext.forgeRunId,
          stageId: 'example',
          artifactType: 'neutral-observation',
          schemaVersion: '0.1.0',
          content: { ok: true },
          contentHash: 'content-hash',
          createdAt: baseContext.initiatedAt,
          immutable: true,
        },
      }),
    ).toBeNull();
  });
});
