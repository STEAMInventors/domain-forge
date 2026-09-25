import type {
  ArtifactId,
  ForgeRunId,
  StageAttemptId,
  StageExecutionId,
} from '@domain-forge/core';
import type { StageEvidenceReference } from './evidence.js';

export type StageStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export type AdversarialOutcome = 'PASS' | 'FIX' | 'REJECT';

/** Deny-by-default input projection declaration */
export interface StageInputProjection {
  allowedArtifactTypes: readonly string[];
  allowedFields: readonly string[];
}

export interface ForgeStageDefinition {
  stageId: string;
  name: string;
  version: string;
  dependencies: readonly string[];
  inputArtifactTypes: readonly string[];
  inputProjection: StageInputProjection;
  outputSchemaId: string;
  promptTemplateId: string;
  promptVersion: string;
  modelPolicy: string;
  permittedTools: readonly string[];
  validatorIds: readonly string[];
  retryPolicy: { maxAttempts: number };
  loopPolicy?: { maxRounds: number };
  budgetPolicy?: { maxInvocations: number };
  gatePolicy?: { requiresHumanApproval: boolean };
  artifactsProduced: readonly string[];
}

export interface ValidationResult {
  validatorId: string;
  validatorVersion: string;
  passed: boolean;
  errors: readonly { code: string; message: string; path?: string }[];
  timestamp: string;
}

export interface ToolInvocationRecord {
  toolName: string;
  request: unknown;
  response: unknown;
  timestamp: string;
}

export interface StageAttempt {
  id: StageAttemptId;
  attemptNumber: number;
  projectedInput: Record<string, unknown>;
  projectedInputHash: string;
  promptTemplateId: string;
  promptVersion: string;
  promptFileHash: string;
  renderedInputHash: string;
  provider: string;
  modelIdentifier: string;
  modelVersion?: string;
  rawResponse: string;
  parsedOutput?: unknown;
  validationResults: readonly ValidationResult[];
  evidenceReferences: readonly StageEvidenceReference[];
  toolInvocations: readonly ToolInvocationRecord[];
  tokenUsage: { input: number; output: number; total: number };
  costUsd?: number;
  startedAt: string;
  completedAt?: string;
  status: StageStatus;
  failure?: { code: string; message: string };
}

export interface ForgeStageExecution {
  id: StageExecutionId;
  forgeRunId: ForgeRunId;
  stageId: string;
  stageDefinitionVersion: string;
  attempts: readonly StageAttempt[];
  outputArtifactId?: ArtifactId;
  status: StageStatus;
  startedAt: string;
  completedAt?: string;
}

export interface ForgeArtifact {
  id: ArtifactId;
  forgeRunId: ForgeRunId;
  stageId: string;
  artifactType: string;
  schemaVersion: string;
  content: unknown;
  contentHash: string;
  createdAt: string;
  immutable: boolean;
}
