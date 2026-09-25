import { describe, expect, it, vi } from 'vitest';
import type { ModelPolicy } from '@domain-forge/contracts';
import { ModelInvocationError } from '@domain-forge/core';
import { OpenAIModelProvider } from './openai-provider.js';

const policy: ModelPolicy = {
  alias: 'reasoning.deep',
  provider: 'openai',
  modelIdentifier: 'gpt-5.6-sol',
};

describe('OpenAIModelProvider', () => {
  it('normalizes structured response text and usage', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'resp_test',
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: '{"ok":true}' }],
            },
          ],
          usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const provider = new OpenAIModelProvider({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const response = await provider.invoke({ prompt: 'hello', jsonSchema: { type: 'object' } }, policy);

    expect(response.parsedJson).toEqual({ ok: true });
    expect(response.tokenUsage).toEqual({ input: 10, output: 4, total: 14 });

    const request = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body['model']).toBe('gpt-5.6-sol');
    expect(body['tools']).toBeUndefined();
  });

  it('rejects hidden latest aliases and provider-native tools', async () => {
    const provider = new OpenAIModelProvider({
      apiKey: 'test-key',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      provider.invoke(
        { prompt: 'hello' },
        { ...policy, modelIdentifier: 'gpt-5.6-sol-latest' },
      ),
    ).rejects.toBeInstanceOf(ModelInvocationError);

    await expect(provider.invoke({ prompt: 'hello', tools: ['web_search'] }, policy)).rejects.toBeInstanceOf(
      ModelInvocationError,
    );
  });
});
