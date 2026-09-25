import { BudgetExceededError, hashObject } from '@domain-forge/core';
import type {
  DeterministicModelConfigRef,
  ModelExecutionMetadata,
  ModelInvocationOutcome,
  ModelPolicy,
  ModelProvider,
  ModelRequest,
} from '@domain-forge/contracts';

export function buildModelConfigRef(policy: ModelPolicy): DeterministicModelConfigRef {
  return {
    policyAlias: policy.alias,
    provider: policy.provider,
    modelIdentifier: policy.modelIdentifier,
    configHash: hashObject({
      alias: policy.alias,
      provider: policy.provider,
      modelIdentifier: policy.modelIdentifier,
      modelVersion: policy.modelVersion,
      maxTokens: policy.maxTokens,
      temperature: policy.temperature,
    }),
    ...(policy.modelVersion !== undefined ? { modelVersion: policy.modelVersion } : {}),
  };
}

export async function invokeModelWithMetadata(
  provider: ModelProvider,
  request: ModelRequest,
  policy: ModelPolicy,
): Promise<ModelInvocationOutcome> {
  const configRef = buildModelConfigRef(policy);
  const invokedAt = new Date().toISOString();
  const requestHash = hashObject({ request, policy: configRef.configHash });

  try {
    const response = await provider.invoke(request, policy);
    const metadata: ModelExecutionMetadata = {
      requestHash,
      responseHash: hashObject(response.rawText),
      provider: response.provider,
      modelIdentifier: response.modelIdentifier,
      tokenUsage: response.tokenUsage,
      invokedAt,
      ...(response.modelVersion !== undefined ? { modelVersion: response.modelVersion } : {}),
      ...(response.costUsd !== undefined ? { costUsd: response.costUsd } : {}),
    };

    return {
      kind: 'SUCCEEDED',
      response,
      metadata,
      configRef,
    };
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      return {
        kind: 'FAILED',
        configRef,
        failure: {
          code: 'BUDGET_EXCEEDED',
          message: error.message,
          retryable: false,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      };
    }

    return {
      kind: 'FAILED',
      configRef,
      failure: {
        code: 'MODEL_INVOCATION_ERROR',
        message: error instanceof Error ? error.message : 'Model invocation failed',
        retryable: true,
      },
    };
  }
}
