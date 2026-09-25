import type { ForgeStageDefinition } from '@domain-forge/contracts';
import { ExampleStageOutputSchema } from '@domain-forge/schemas';
import { makeResult } from '@domain-forge/validation';

/** Domain-neutral example stage — no domain-specific semantics */
export const EXAMPLE_STAGE_DEFINITION: ForgeStageDefinition = {
  stageId: 'example-neutral',
  name: 'Neutral Metric Observation',
  version: '0.1.0',
  dependencies: [],
  inputArtifactTypes: ['seed-input'],
  inputProjection: {
    allowedArtifactTypes: ['seed-input'],
    allowedFields: ['seedValue', 'label'],
  },
  outputSchemaId: 'example-stage-output@0.1.0',
  promptTemplateId: 'example-neutral',
  promptVersion: '0.1.0',
  modelPolicy: 'reasoning.deep',
  permittedTools: [],
  validatorIds: ['schema'],
  retryPolicy: { maxAttempts: 3 },
  artifactsProduced: ['neutral-observation'],
};

export function validateExampleStageOutput(output: unknown) {
  const result = ExampleStageOutputSchema.safeParse(output);
  if (result.success) {
    return makeResult('example-stage-output', '0.1.0', true);
  }
  return makeResult(
    'example-stage-output',
    '0.1.0',
    false,
    result.error.issues.map((i) => ({
      code: 'SCHEMA_VALIDATION_ERROR',
      message: i.message,
      path: i.path.join('.'),
    })),
  );
}
