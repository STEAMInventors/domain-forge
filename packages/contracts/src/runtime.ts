import type { ModelPolicy, ModelRequest, ModelResponse } from './models.js';

/** Provider-neutral deterministic model configuration reference */
export interface DeterministicModelConfigRef {
  readonly policyAlias: string;
  readonly provider: string;
  readonly modelIdentifier: string;
  readonly modelVersion?: string;
  readonly configHash: string;
}

export interface ModelExecutionMetadata {
  readonly requestHash: string;
  readonly responseHash: string;
  readonly provider: string;
  readonly modelIdentifier: string;
  readonly modelVersion?: string;
  readonly tokenUsage: { readonly input: number; readonly output: number; readonly total: number };
  readonly costUsd?: number;
  readonly invokedAt: string;
}

export interface ModelInvocationFailure {
  readonly code: 'MODEL_INVOCATION_ERROR' | 'MODEL_OUTPUT_ERROR' | 'BUDGET_EXCEEDED';
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ModelInvocationOutcome =
  | {
      readonly kind: 'SUCCEEDED';
      readonly response: ModelResponse;
      readonly metadata: ModelExecutionMetadata;
      readonly configRef: DeterministicModelConfigRef;
    }
  | {
      readonly kind: 'FAILED';
      readonly failure: ModelInvocationFailure;
      readonly configRef: DeterministicModelConfigRef;
      readonly metadata?: ModelExecutionMetadata;
    };

export interface ModelProviderInvokeInput {
  readonly request: ModelRequest;
  readonly policy: ModelPolicy;
  readonly configRef: DeterministicModelConfigRef;
}
