import { describe, expect, it } from 'vitest';
import type { ModelPolicy } from '@domain-forge/contracts';
import { FakeModelProvider } from './fake-provider.js';
import { ModelProviderRouter } from './provider-router.js';

describe('ModelProviderRouter', () => {
  it('routes by policy provider without changing the runtime contract', async () => {
    const router = new ModelProviderRouter([
      new FakeModelProvider('openai', { default: '{"provider":"openai"}' }),
      new FakeModelProvider('anthropic', { default: '{"provider":"anthropic"}' }),
    ]);

    const policy: ModelPolicy = {
      alias: 'reasoning.deep',
      provider: 'anthropic',
      modelIdentifier: 'claude-opus-5',
    };

    const response = await router.invoke({ prompt: 'test' }, policy);
    expect(response.provider).toBe('anthropic');
    expect(response.parsedJson).toEqual({ provider: 'anthropic' });
  });
});
