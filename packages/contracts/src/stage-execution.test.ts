import { describe, it, expect } from 'vitest';
import { STAGE_ERROR_CODES, stageFailure, isStageErrorCode } from './stage-errors.js';
import {
  getStageExecutionRequirements,
  getStageInputContract,
  getStageOutputContract,
} from './stage-contract.js';
import type { ForgeStageDefinition } from './stage.js';

const SAMPLE_DEFINITION: ForgeStageDefinition = {
  stageId: 'example-neutral',
  name: 'Example',
  version: '0.1.0',
  dependencies: [],
  inputArtifactTypes: ['seed-input'],
  inputProjection: {
    allowedArtifactTypes: ['seed-input'],
    allowedFields: ['seedValue'],
  },
  outputSchemaId: 'example@0.1.0',
  promptTemplateId: 'example-neutral',
  promptVersion: '0.1.0',
  modelPolicy: 'reasoning.deep',
  permittedTools: [],
  validatorIds: ['schema'],
  retryPolicy: { maxAttempts: 1 },
  gatePolicy: { requiresHumanApproval: false },
  artifactsProduced: ['neutral-observation'],
};

describe('stage contract helpers', () => {
  it('extracts input and output contracts from definition', () => {
    expect(getStageInputContract(SAMPLE_DEFINITION).requiredArtifactTypes).toEqual(['seed-input']);
    expect(getStageOutputContract(SAMPLE_DEFINITION).schemaId).toBe('example@0.1.0');
  });

  it('derives execution requirements without domain knowledge', () => {
    const requirements = getStageExecutionRequirements(SAMPLE_DEFINITION);
    expect(requirements.requiresModelInvocation).toBe(true);
    expect(requirements.requiresStage0ApprovalUnlessSelf).toBe(true);
    expect(requirements.deterministicValidationRequired).toBe(true);
  });

  it('stage-0 skips stage0 approval requirement on self', () => {
    const stage0 = { ...SAMPLE_DEFINITION, stageId: 'stage-0' };
    expect(getStageExecutionRequirements(stage0).requiresStage0ApprovalUnlessSelf).toBe(false);
  });
});

describe('stage error codes', () => {
  it('uses stable machine-readable codes', () => {
    expect(STAGE_ERROR_CODES).toContain('INVALID_STAGE_INPUT');
    expect(STAGE_ERROR_CODES).toContain('HUMAN_REVIEW_REQUIRED');
    expect(isStageErrorCode('MODEL_OUTPUT_ERROR')).toBe(true);
    expect(isStageErrorCode('NOT_A_CODE')).toBe(false);
  });

  it('builds structured failures without free-text-only representation', () => {
    const failure = stageFailure('DETERMINISTIC_VALIDATION_FAILED', 'validator rejected output', {
      path: 'metricValue',
    });
    expect(failure.code).toBe('DETERMINISTIC_VALIDATION_FAILED');
    expect(failure.message).toBe('validator rejected output');
    expect(failure.path).toBe('metricValue');
  });
});
