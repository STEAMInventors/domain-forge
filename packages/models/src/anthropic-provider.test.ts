import { describe, expect, it, vi } from 'vitest';
import type { ModelPolicy } from '@domain-forge/contracts';
import { ModelInvocationError } from '@domain-forge/core';
import { AnthropicModelProvider } from './anthropic-provider.js';

const policy: ModelPolicy = {
  alias: 'adversarial.independent',
  provider: 'anthropic',
  modelIdentifier: 'claude-opus-5',
};

describe('AnthropicModelProvider', () => {
  it('normalizes structured response text and usage', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, _init) =>
      new Response(
        JSON.stringify({
          id: 'msg_test',
          model: 'claude-opus-5',
          content: [{ type: 'text', text: '{"ok":true}' }],
          usage: {
            input_tokens: 10,
            cache_creation_input_tokens: 2,
            cache_read_input_tokens: 3,
            output_tokens: 4,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const provider = new AnthropicModelProvider({
      apiKey: 'test-key',
      fetchImpl: fetchImpl as typeof fetch,
    });
    const response = await provider.invoke({ prompt: 'hello', jsonSchema: { type: 'object' } }, policy);

    expect(response.parsedJson).toEqual({ ok: true });
    expect(response.tokenUsage).toEqual({ input: 15, output: 4, total: 19 });

    const request = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body['model']).toBe('claude-opus-5');
    expect(body['tools']).toBeUndefined();
  });

  it('rejects provider-native tools', async () => {
    const provider = new AnthropicModelProvider({
      apiKey: 'test-key',
      fetchImpl: vi.fn() as unknown as typeof fetch,
    });

    await expect(provider.invoke({ prompt: 'hello', tools: ['web_search'] }, policy)).rejects.toBeInstanceOf(
      ModelInvocationError,
    );
  });
});
