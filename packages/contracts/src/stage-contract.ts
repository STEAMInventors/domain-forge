import type { ForgeStageDefinition, StageInputProjection } from './stage.js';

/** Declared typed input boundary for a stage */
export interface StageInputContract {
  readonly requiredArtifactTypes: readonly string[];
  readonly projection: StageInputProjection;
}

/** Declared typed output boundary for a stage */
export interface StageOutputContract {
  readonly schemaId: string;
  readonly artifactTypes: readonly string[];
  readonly validatorIds: readonly string[];
}

/** Execution requirements enforced by the generic runtime */
export interface StageExecutionRequirements {
  readonly requiresModelInvocation: boolean;
  readonly requiresStage0ApprovalUnlessSelf: boolean;
  readonly humanInterventionMayBeRequired: boolean;
  readonly deterministicValidationRequired: boolean;
}

export interface StageIdentity {
  readonly stageId: string;
  readonly definitionVersion: string;
}

export function getStageIdentity(definition: ForgeStageDefinition): StageIdentity {
  return {
    stageId: definition.stageId,
    definitionVersion: definition.version,
  };
}

export function getStageInputContract(definition: ForgeStageDefinition): StageInputContract {
  return {
    requiredArtifactTypes: definition.inputArtifactTypes,
    projection: definition.inputProjection,
  };
}

export function getStageOutputContract(definition: ForgeStageDefinition): StageOutputContract {
  return {
    schemaId: definition.outputSchemaId,
    artifactTypes: definition.artifactsProduced,
    validatorIds: definition.validatorIds,
  };
}

export function getStageExecutionRequirements(
  definition: ForgeStageDefinition,
): StageExecutionRequirements {
  return {
    requiresModelInvocation: true,
    requiresStage0ApprovalUnlessSelf: definition.stageId !== 'stage-0',
    humanInterventionMayBeRequired: definition.gatePolicy?.requiresHumanApproval ?? false,
    deterministicValidationRequired: definition.validatorIds.length > 0,
  };
}
