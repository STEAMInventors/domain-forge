import { hashObject } from '@domain-forge/core';
import type {
  ForgeRun,
  ForgeStageDefinition,
  StageArtifactRef,
  StageExecutionContext,
  ImmutableConfigRef,
} from '@domain-forge/contracts';
import { getStageIdentity } from '@domain-forge/contracts';
import { projectStageInput } from '@domain-forge/validation';
import { deepFreeze } from './immutability.js';

export interface BuildStageExecutionContextInput {
  run: ForgeRun;
  definition: ForgeStageDefinition;
  artifacts: Record<string, unknown>;
  packContentHash?: string;
  configRefs?: readonly ImmutableConfigRef[];
}

export function buildStageExecutionContext(
  input: BuildStageExecutionContextInput,
): { context: StageExecutionContext; projected: Record<string, unknown> } {
  const { projected, projectedInputHash } = projectStageInput(input.definition, input.artifacts);

  const dependencyArtifacts: StageArtifactRef[] = input.definition.inputArtifactTypes.map(
    (artifactType) => {
      if (artifactType in input.artifacts) {
        return {
          artifactType,
          contentHash: hashObject(input.artifacts[artifactType]),
        };
      }
      return { artifactType };
    },
  );

  const context: StageExecutionContext = {
    forgeRunId: input.run.id,
    packId: input.run.packId,
    packVersionId: input.run.packVersionId,
    stageIdentity: getStageIdentity(input.definition),
    projectedInput: projected,
    projectedInputHash,
    dependencyArtifacts,
    configRefs: input.configRefs ?? [],
    initiatedAt: new Date().toISOString(),
    ...(input.packContentHash !== undefined ? { packContentHash: input.packContentHash } : {}),
  };

  return {
    context: deepFreeze(context),
    projected,
  };
}
