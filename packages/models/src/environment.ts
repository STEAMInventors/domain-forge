import type { ModelPolicy, ModelProvider } from '@domain-forge/contracts';
import { ConfigurationError } from '@domain-forge/core';
import { AnthropicModelProvider } from './anthropic-provider.js';
import { OpenAIModelProvider } from './openai-provider.js';
import { ModelPolicyRegistry } from './policy-registry.js';
import { ModelProviderRouter } from './provider-router.js';

type Env = Readonly<Record<string, string | undefined>>;

interface PolicyEnvSpec {
  readonly alias: string;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
}

const POLICY_ENV_SPECS: readonly PolicyEnvSpec[] = [
  {
    alias: 'research.high_accuracy',
    provider: 'FORGE_RESEARCH_PROVIDER',
    model: 'FORGE_RESEARCH_MODEL',
    modelVersion: 'FORGE_RESEARCH_MODEL_VERSION',
  },
  {
    alias: 'extraction.high_volume',
    provider: 'FORGE_EXTRACTION_PROVIDER',
    model: 'FORGE_EXTRACTION_MODEL',
    modelVersion: 'FORGE_EXTRACTION_MODEL_VERSION',
  },
  {
    alias: 'reasoning.deep',
    provider: 'FORGE_RULE_PROVIDER',
    model: 'FORGE_RULE_MODEL',
    modelVersion: 'FORGE_RULE_MODEL_VERSION',
  },
  {
    alias: 'adversarial.independent',
    provider: 'FORGE_ADVERSARIAL_PROVIDER',
    model: 'FORGE_ADVERSARIAL_MODEL',
    modelVersion: 'FORGE_ADVERSARIAL_MODEL_VERSION',
  },
  {
    alias: 'fixture.high_volume',
    provider: 'FORGE_FIXTURE_PROVIDER',
    model: 'FORGE_FIXTURE_MODEL',
    modelVersion: 'FORGE_FIXTURE_MODEL_VERSION',
  },
];

function requiredEnv(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`, {
      environmentVariable: name,
    });
  }
  return value;
}

function optionalEnv(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function optionalPositiveInteger(env: Env, name: string): number | undefined {
  const raw = optionalEnv(env, name);
  if (raw === undefined) return undefined;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ConfigurationError(`${name} must be a positive integer`, {
      environmentVariable: name,
    });
  }
  return value;
}

function assertAllowedProvider(provider: string, environmentVariable: string): void {
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new ConfigurationError(
      `${environmentVariable} must be "openai" or "anthropic" for production model configuration`,
      { environmentVariable, provider },
    );
  }
}

export function createProductionPolicyRegistryFromEnv(env: Env = process.env): ModelPolicyRegistry {
  const registry = new ModelPolicyRegistry();

  for (const spec of POLICY_ENV_SPECS) {
    const provider = requiredEnv(env, spec.provider);
    assertAllowedProvider(provider, spec.provider);

    const modelIdentifier = requiredEnv(env, spec.model);
    const modelVersion = optionalEnv(env, spec.modelVersion);

    const policy: ModelPolicy = {
      alias: spec.alias,
      provider,
      modelIdentifier,
      ...(modelVersion !== undefined ? { modelVersion } : {}),
    };
    registry.register(policy);
  }

  return registry;
}

export function createProductionModelProviderFromEnv(env: Env = process.env): ModelProvider {
  const providers: ModelProvider[] = [];
  const configuredProviderNames = new Set(
    POLICY_ENV_SPECS.map((spec) => requiredEnv(env, spec.provider)),
  );

  for (const providerName of configuredProviderNames) {
    assertAllowedProvider(providerName, 'model provider configuration');
  }

  const sharedTimeoutMs = optionalPositiveInteger(env, 'FORGE_MODEL_TIMEOUT_MS');
  const anthropicWorkspaceId = optionalEnv(env, 'ANTHROPIC_WORKSPACE_ID');

  if (configuredProviderNames.has('openai')) {
    providers.push(
      new OpenAIModelProvider({
        apiKey: requiredEnv(env, 'OPENAI_API_KEY'),
        ...(sharedTimeoutMs !== undefined ? { timeoutMs: sharedTimeoutMs } : {}),
      }),
    );
  }

  if (configuredProviderNames.has('anthropic')) {
    providers.push(
      new AnthropicModelProvider({
        apiKey: requiredEnv(env, 'ANTHROPIC_API_KEY'),
        ...(anthropicWorkspaceId !== undefined
          ? { workspaceId: anthropicWorkspaceId }
          : {}),
        ...(sharedTimeoutMs !== undefined ? { timeoutMs: sharedTimeoutMs } : {}),
      }),
    );
  }

  return new ModelProviderRouter(providers);
}

export function createProductionModelRuntimeFromEnv(env: Env = process.env): {
  readonly modelProvider: ModelProvider;
  readonly policyRegistry: ModelPolicyRegistry;
} {
  const policyRegistry = createProductionPolicyRegistryFromEnv(env);
  const modelProvider = createProductionModelProviderFromEnv(env);
  return { modelProvider, policyRegistry };
}
