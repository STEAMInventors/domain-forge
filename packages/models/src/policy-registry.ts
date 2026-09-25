import type { ModelPolicy } from '@domain-forge/contracts';
import { ConfigurationError } from '@domain-forge/core';

/** Maps policy aliases to provider/model configuration */
export class ModelPolicyRegistry {
  private readonly policies = new Map<string, ModelPolicy>();

  register(policy: ModelPolicy): void {
    this.policies.set(policy.alias, policy);
  }

  resolve(alias: string): ModelPolicy {
    const policy = this.policies.get(alias);
    if (!policy) {
      throw new ConfigurationError(`Unknown model policy alias: ${alias}`);
    }
    return policy;
  }

  list(): ModelPolicy[] {
    return [...this.policies.values()];
  }
}

export function createDefaultPolicyRegistry(): ModelPolicyRegistry {
  const registry = new ModelPolicyRegistry();
  registry.register({ alias: 'research.high_accuracy', provider: 'fake', modelIdentifier: 'fake-research-v1' });
  registry.register({ alias: 'extraction.high_volume', provider: 'fake', modelIdentifier: 'fake-extract-v1' });
  registry.register({ alias: 'reasoning.deep', provider: 'fake', modelIdentifier: 'fake-reason-v1' });
  registry.register({ alias: 'adversarial.independent', provider: 'fake', modelIdentifier: 'fake-adversarial-v1' });
  registry.register({ alias: 'fixture.high_volume', provider: 'fake', modelIdentifier: 'fake-fixture-v1' });
  return registry;
}
