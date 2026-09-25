import { describe, it, expect } from 'vitest';
import {
  createSourceClassificationRegistry,
  createSourceTierResolver,
  DefaultSourceTierResolver,
} from './index.js';
import { RegistryError } from '@domain-forge/core';

describe('SourceClassificationRegistry', () => {
  it('creates default classification registry', () => {
    const registry = createSourceClassificationRegistry();
    expect(registry.rules.length).toBeGreaterThan(0);
    expect(registry.version).toBe('1.0.0');
  });

  it('rejects duplicate rule ids', () => {
    const rules = createSourceClassificationRegistry().rules;
    expect(() => createSourceClassificationRegistry([...rules, ...rules])).toThrow(RegistryError);
  });

  it('rejects invalid tier references', () => {
    expect(() =>
      createSourceClassificationRegistry([
        {
          id: 'bad-tier',
          description: 'Bad',
          priority: 1,
          match: { sourceType: 'file' },
          tier: '99',
        },
      ]),
    ).toThrow(RegistryError);
  });
});

describe('SourceTierResolver', () => {
  it('resolves tier from classification rules', () => {
    const resolver = DefaultSourceTierResolver;
    const result = resolver.resolve({
      authorityCategory: 'primary',
      proposedSourceTier: '6',
    });
    expect(result.resolved).toBe(true);
    expect(result.resolvedSourceTier).toBe('1');
    expect(result.proposedSourceTier).toBe('6');
    expect(result.ruleId).toBe('classify-primary-authority');
  });

  it('accepts code-validated proposed tier when no rule matches', () => {
    const resolver = createSourceTierResolver(
      createSourceClassificationRegistry([]),
    );
    const result = resolver.resolve({ proposedSourceTier: '3' });
    expect(result.resolved).toBe(true);
    expect(result.resolvedSourceTier).toBe('3');
  });

  it('fails closed on unknown proposed tier', () => {
    const resolver = createSourceTierResolver(createSourceClassificationRegistry([]));
    const result = resolver.resolve({ proposedSourceTier: 'invalid' });
    expect(result.resolved).toBe(false);
    expect(result.resolvedSourceTier).toBeUndefined();
  });

  it('resolveOrThrow fails when tier cannot be resolved', () => {
    expect(() =>
      DefaultSourceTierResolver.resolveOrThrow({ proposedSourceTier: 'invalid' }),
    ).toThrow(RegistryError);
  });

  it('does not treat model-proposed tier as authoritative without validation', () => {
    const resolver = createSourceTierResolver(createSourceClassificationRegistry([]));
    const result = resolver.resolve({ proposedSourceTier: 'not-a-tier' });
    expect(result.resolvedSourceTier).toBeUndefined();
  });
});
