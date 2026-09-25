import type { ModelPolicy, ModelProvider, ModelRequest, ModelResponse } from '@domain-forge/contracts';
import { ModelInvocationError } from '@domain-forge/core';

export class ModelProviderRouter implements ModelProvider {
  readonly providerName = 'configured';
  private readonly providers = new Map<string, ModelProvider>();

  constructor(providers: readonly ModelProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.providerName)) {
        throw new ModelInvocationError(
          `Duplicate model provider registration: ${provider.providerName}`,
          { provider: provider.providerName },
          false,
        );
      }
      this.providers.set(provider.providerName, provider);
    }
  }

  getModelIdentity(policy: ModelPolicy): string {
    return this.resolve(policy.provider).getModelIdentity(policy);
  }

  invoke(request: ModelRequest, policy: ModelPolicy): Promise<ModelResponse> {
    return this.resolve(policy.provider).invoke(request, policy);
  }

  private resolve(providerName: string): ModelProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new ModelInvocationError(
        `No model provider is configured for "${providerName}"`,
        {
          provider: providerName,
          configuredProviders: [...this.providers.keys()].sort(),
        },
        false,
      );
    }
    return provider;
  }
}
