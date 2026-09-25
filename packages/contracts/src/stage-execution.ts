import type {
  ArtifactId,
  ForgeRunId,
  PackId,
  PackVersionId,
  StageAttemptId,
  StageExecutionId,
} from '@domain-forge/core';
import type { ValidationResult } from './stage.js';
import type { ModelExecutionMetadata } from './runtime.js';
import type { StageFailureDetail } from './stage-errors.js';
import type { StageIdentity } from './stage-contract.js';
import type { ForgeArtifact, ForgeStageExecution, StageAttempt } from './stage.js';

/** Immutable configuration reference passed into stage execution */
export interface ImmutableConfigRef {
  readonly refType: 'prompt' | 'model-policy' | 'validator' | 'schema';
  readonly id: string;
  readonly version: string;
  readonly contentHash: string;
}

/** Reference to upstream artifact content without exposing undeclared fields */
export interface StageArtifactRef {
  readonly artifactType: string;
  readonly artifactId?: ArtifactId;
  readonly contentHash?: string;
}

/**
 * Portable, testable execution context.
 * Stages must treat all fields as read-only; the runtime deep-freezes instances.
 */
export interface StageExecutionContext {
  readonly forgeRunId: ForgeRunId;
  readonly packId: PackId;
  readonly packVersionId: PackVersionId;
  readonly packContentHash?: string;
  readonly stageIdentity: StageIdentity;
  readonly projectedInput: Readonly<Record<string, unknown>>;
  readonly projectedInputHash: string;
  readonly dependencyArtifacts: readonly StageArtifactRef[];
  readonly configRefs: readonly ImmutableConfigRef[];
  readonly initiatedAt: string;
}

/** Untrusted model-generated output — never an accepted artifact */
export interface StageProposedOutput {
  readonly source: 'MODEL';
  readonly rawText: string;
  readonly parsed?: unknown;
  readonly modelExecution: ModelExecutionMetadata;
  readonly rawResponseHash: string;
}

/** Deterministically validated output eligible for artifact materialization */
export interface StageAcceptedOutput {
  readonly source: 'VALIDATED';
  readonly content: unknown;
  readonly contentHash: string;
  readonly validationResults: readonly ValidationResult[];
  readonly proposedOutputRef: {
    readonly rawResponseHash: string;
    readonly attemptNumber: number;
  };
}

export type StageAcceptanceResult =
  | {
      readonly status: 'ACCEPTED';
      readonly proposed: StageProposedOutput;
      readonly accepted: StageAcceptedOutput;
    }
  | {
      readonly status: 'VALIDATION_FAILED';
      readonly proposed: StageProposedOutput;
      readonly validationResults: readonly ValidationResult[];
      readonly failure: StageFailureDetail;
    }
  | {
      readonly status: 'NEEDS_REVIEW';
      readonly proposed: StageProposedOutput;
      readonly validationResults: readonly ValidationResult[];
      readonly reviewReason: StageFailureDetail;
    };

/**
 * Discriminated stage execution outcome.
 * No variant combines success with error fields.
 */
export type StageExecutionOutcome =
  | {
      readonly kind: 'SUCCEEDED';
      readonly context: StageExecutionContext;
      readonly execution: ForgeStageExecution;
      readonly attempt: StageAttempt;
      readonly proposed: StageProposedOutput;
      readonly accepted: StageAcceptedOutput;
      readonly artifact: ForgeArtifact;
    }
  | {
      readonly kind: 'VALIDATION_FAILED';
      readonly context: StageExecutionContext;
      readonly execution: ForgeStageExecution;
      readonly attempt: StageAttempt;
      readonly proposed: StageProposedOutput;
      readonly failure: StageFailureDetail;
      readonly validationResults: readonly ValidationResult[];
    }
  | {
      readonly kind: 'HUMAN_REVIEW_REQUIRED';
      readonly context: StageExecutionContext;
      readonly execution: ForgeStageExecution;
      readonly attempt: StageAttempt;
      readonly proposed: StageProposedOutput;
      readonly reviewReason: StageFailureDetail;
      readonly validationResults: readonly ValidationResult[];
    }
  | {
      readonly kind: 'BLOCKED';
      readonly context: StageExecutionContext;
      readonly failure: StageFailureDetail;
    }
  | {
      readonly kind: 'INVALID_INPUT';
      readonly context: StageExecutionContext;
      readonly failure: StageFailureDetail;
    }
  | {
      readonly kind: 'RUNTIME_FAILED';
      readonly context: StageExecutionContext;
      readonly failure: StageFailureDetail;
      readonly attempt?: StageAttempt;
      readonly execution?: ForgeStageExecution;
    };

export interface StageExecutionRecordIds {
  readonly executionId: StageExecutionId;
  readonly attemptId: StageAttemptId;
}
