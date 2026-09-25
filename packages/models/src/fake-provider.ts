import type { ModelPolicy, ModelProvider, ModelRequest, ModelResponse } from '@domain-forge/contracts';
import { hashObject } from '@domain-forge/core';

/** Deterministic fake model provider for tests — no live LLM calls */
export class FakeModelProvider implements ModelProvider {
  readonly providerName: string;
  private readonly responses: Map<string, string>;

  constructor(providerName = 'fake', responses?: Record<string, string>) {
    this.providerName = providerName;
    this.responses = new Map(Object.entries(responses ?? {}));
  }

  getModelIdentity(policy: ModelPolicy): string {
    return `${policy.provider}:${policy.modelIdentifier}${policy.modelVersion ? `@${policy.modelVersion}` : ''}`;
  }

  async invoke(request: ModelRequest, policy: ModelPolicy): Promise<ModelResponse> {
    const key = hashObject({ prompt: request.prompt, policy: policy.alias });
    const rawText = this.responses.get(key) ?? this.responses.get('default') ?? '{}';

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      parsedJson = undefined;
    }

    const response: ModelResponse = {
      rawText,
      parsedJson,
      tokenUsage: { input: request.prompt.length, output: rawText.length, total: request.prompt.length + rawText.length },
      costUsd: 0,
      modelIdentifier: policy.modelIdentifier,
      provider: this.providerName,
    };
    if (policy.modelVersion !== undefined) {
      response.modelVersion = policy.modelVersion;
    }
    return response;
  }

  registerResponse(key: string, response: string): void {
    this.responses.set(key, response);
  }
}
