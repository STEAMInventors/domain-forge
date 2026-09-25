import { describe, expect, it } from 'vitest';
import { ConfigurationError } from '@domain-forge/core';
import {
  createProductionModelProviderFromEnv,
  createProductionPolicyRegistryFromEnv,
} from './environment.js';

const baseEnv = {
  OPENAI_API_KEY: 'test-openai-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  FORGE_RESEARCH_PROVIDER: 'openai',
  FORGE_RESEARCH_MODEL: 'gpt-5.6-sol',
  FORGE_EXTRACTION_PROVIDER: 'anthropic',
  FORGE_EXTRACTION_MODEL: 'claude-sonnet-5',
  FORGE_RULE_PROVIDER: 'openai',
  FORGE_RULE_MODEL: 'gpt-5.6-sol',
  FORGE_RULE_MODEL_VERSION: 'explicit-config-version',
  FORGE_ADVERSARIAL_PROVIDER: 'anthropic',
  FORGE_ADVERSARIAL_MODEL: 'claude-opus-5',
  FORGE_FIXTURE_PROVIDER: 'anthropic',
  FORGE_FIXTURE_MODEL: 'claude-sonnet-5',
};

describe('production model environment configuration', () => {
  it('maps provider-neutral policy aliases to explicit provider/model configuration', () => {
    const registry = createProductionPolicyRegistryFromEnv(baseEnv);
    expect(registry.resolve('reasoning.deep')).toEqual({
      alias: 'reasoning.deep',
      provider: 'openai',
      modelIdentifier: 'gpt-5.6-sol',
      modelVersion: 'explicit-config-version',
    });
  });

  it('requires API keys only for providers selected by policy configuration', () => {
    expect(createProductionModelProviderFromEnv(baseEnv).providerName).toBe('configured');
  });

  it('fails closed on missing policy model selection', () => {
    expect(() =>
      createProductionPolicyRegistryFromEnv({
        ...baseEnv,
        FORGE_RULE_MODEL: '',
      }),
    ).toThrow(ConfigurationError);
  });

  it('rejects unsupported production providers', () => {
    expect(() =>
      createProductionPolicyRegistryFromEnv({
        ...baseEnv,
        FORGE_RULE_PROVIDER: 'fake',
      }),
    ).toThrow(ConfigurationError);
  });
});
