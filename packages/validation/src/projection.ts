import { StageProjectionError } from '@domain-forge/core';
import type { ForgeStageDefinition } from '@domain-forge/contracts';
import { hashObject } from '@domain-forge/core';

/** Deny-by-default stage input projection */
export function projectStageInput(
  definition: ForgeStageDefinition,
  artifacts: Record<string, unknown>,
): { projected: Record<string, unknown>; projectedInputHash: string } {
  const projected: Record<string, unknown> = {};

  for (const artifactType of definition.inputProjection.allowedArtifactTypes) {
    if (!(artifactType in artifacts)) {
      continue;
    }
    const artifact = artifacts[artifactType];
    if (typeof artifact !== 'object' || artifact === null) {
      throw new StageProjectionError(`Artifact ${artifactType} is not an object`);
    }

    const content = (artifact as { content?: unknown }).content ?? artifact;
    if (typeof content !== 'object' || content === null) {
      throw new StageProjectionError(`Artifact ${artifactType} content is not an object`);
    }

    const record = content as Record<string, unknown>;
    for (const field of definition.inputProjection.allowedFields) {
      if (field in record) {
        projected[field] = record[field];
      }
    }
  }

  const artifactKeys = Object.keys(artifacts);
  for (const key of artifactKeys) {
    if (!definition.inputProjection.allowedArtifactTypes.includes(key)) {
      throw new StageProjectionError(
        `Artifact type "${key}" not in allowed projection for stage ${definition.stageId}`,
      );
    }
  }

  return {
    projected,
    projectedInputHash: hashObject(projected),
  };
}
