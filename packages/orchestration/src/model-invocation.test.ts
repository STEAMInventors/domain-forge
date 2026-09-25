import { describe, expect, it } from 'vitest';
import type { ModelPolicy, ModelProvider } from '@domain-forge/contracts';
import { ModelInvocationError, ModelOutputError } from '@domain-forge/core';
import { invokeModelWithMetadata } from './model-invocation.js';

const policy: ModelPolicy = {
  alias: 'reasoning.deep',
  provider: 'openai',
  modelIdentifier: 'gpt-5.6-sol',
};

describe('invokeModelWithMetadata provider errors', () => {
  it('preserves structured invocation error retryability and details', async () => {
    const provider: ModelProvider = {
      providerName: 'openai',
      getModelIdentity: () => 'openai:gpt-5.6-sol',
      invoke: async () => {
        throw new ModelInvocationError(
          'OpenAI model invocation failed with HTTP 429',
          { provider: 'openai', httpStatus: 429, requestId: 'req-1' },
          true,
        );
      },
    };

    const outcome = await invokeModelWithMetadata(provider, { prompt: 'test' }, policy);

    expect(outcome).toMatchObject({
      kind: 'FAILED',
      failure: {
        code: 'MODEL_INVOCATION_ERROR',
        retryable: true,
        details: { provider: 'openai', httpStatus: 429, requestId: 'req-1' },
      },
    });
  });

  it('preserves non-retryable provider output errors', async () => {
    const provider: ModelProvider = {
      providerName: 'openai',
      getModelIdentity: () => 'openai:gpt-5.6-sol',
      invoke: async () => {
        throw new ModelOutputError('OpenAI response is missing required output', {
          provider: 'openai',
        });
      },
    };

    const outcome = await invokeModelWithMetadata(provider, { prompt: 'test' }, policy);

    expect(outcome).toMatchObject({
      kind: 'FAILED',
      failure: {
        code: 'MODEL_OUTPUT_ERROR',
        retryable: false,
        details: { provider: 'openai' },
      },
    });
  });
});
