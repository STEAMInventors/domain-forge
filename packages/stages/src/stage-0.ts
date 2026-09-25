import type { ForgeStageDefinition } from '@domain-forge/contracts';

/** Stage 0 — Legality & Service Boundary (hard human gate) */
export const STAGE_0_DEFINITION: ForgeStageDefinition = {
  stageId: 'stage-0',
  name: 'Legality & Service Boundary',
  version: '0.1.0',
  dependencies: [],
  inputArtifactTypes: ['domain-intent'],
  inputProjection: {
    allowedArtifactTypes: ['domain-intent'],
    allowedFields: ['domainId', 'scopeDescription', 'jurisdiction'],
  },
  outputSchemaId: 'stage-0-output@0.1.0',
  promptTemplateId: 'stage-0-legality',
  promptVersion: '0.1.0',
  modelPolicy: 'research.high_accuracy',
  permittedTools: ['forge-search', 'forge-retrieve'],
  validatorIds: ['schema', 'evidence'],
  retryPolicy: { maxAttempts: 2 },
  gatePolicy: { requiresHumanApproval: true },
  artifactsProduced: ['legality-assessment'],
};
