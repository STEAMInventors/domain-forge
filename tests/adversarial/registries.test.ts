import { describe, it, expect } from 'vitest';
import {
  buildRegistry,
  createPackRegistries,
  isBannedQuestionLanguage,
  acceptQuestionLanguageEntry,
  RegistryError,
  assertRegistryReferences,
} from '@domain-forge/core';
import { composeDomainPack, packToDependencyRef, minimalDomainPack } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';

describe('adversarial: registries', () => {
  it('rejects duplicate canonical IDs at build time', () => {
    expect(() =>
      buildRegistry('test', [
        { id: 'dup', description: 'One' },
        { id: 'dup', description: 'Two' },
      ]),
    ).toThrow(RegistryError);
  });

  it('rejects duplicate aliases across entries', () => {
    expect(() =>
      buildRegistry('test', [
        { id: 'one', description: 'One', aliases: ['shared-alias'] },
        { id: 'two', description: 'Two', aliases: ['shared-alias'] },
      ]),
    ).toThrow(RegistryError);
  });

  it('rejects ambiguous alias resolution for unknown alias', () => {
    const registry = buildRegistry('test', [{ id: 'known', description: 'Known' }]);
    expect(() => registry.resolve('unknown-alias')).toThrow(RegistryError);
    expect(registry.has('unknown-alias')).toBe(false);
  });

  it('rejects dangling cross-references in pack registries', () => {
    const pack = createMinimalTestPack({
      rules: [
        {
          id: 'rule-dangling',
          primitive: 'REQUIRE',
          entityIds: ['nonexistent-entity'],
          factIds: ['nonexistent-fact'],
          authorityRefIds: [],
        },
      ],
    });
    const registries = createPackRegistries(pack);
    expect(() => registries.validateCrossReferences()).toThrow();
  });

  it('produces deterministic fingerprint for same composed pack', () => {
    const pack = createMinimalTestPack();
    const first = createPackRegistries(pack);
    const second = createPackRegistries(pack);
    expect(first.getFingerprint()).toBe(second.getFingerprint());
  });

  it('produces different fingerprint when composed pack content changes', () => {
    const base = createMinimalTestPack();
    const changed = createMinimalTestPack({
      entities: [{ id: 'entity-changed', grammarType: 'Party', label: 'Changed entity' }],
    });
    const fpA = createPackRegistries(base).getFingerprint();
    const fpB = createPackRegistries(changed).getFingerprint();
    expect(fpA).not.toBe(fpB);
  });

  it('rejects model-proposed invalid source tier at registry boundary', () => {
    expect(() =>
      buildRegistry('source-tier', [{ id: '99', description: 'Invalid tier' }]),
    ).not.toThrow();
    const registry = buildRegistry('source-tier', [{ id: '1', description: 'Tier 1' }]);
    expect(registry.has('99')).toBe(false);
  });

  it('rejects banned question-language phrases', () => {
    expect(isBannedQuestionLanguage('You will always qualify')).toBe(true);
    expect(isBannedQuestionLanguage('We guarantee approval')).toBe(true);
    expect(isBannedQuestionLanguage('What is the effective date?')).toBe(false);
  });

  it('accepts valid proposed question-language registry entries', () => {
    const entry = acceptQuestionLanguageEntry({
      id: 'ql-test-001',
      phrase: 'test-phrase',
      restriction: 'restricted',
      reason: 'Requires authority backing',
      description: 'Test restricted phrase',
    });
    expect(entry.phrase).toBe('test-phrase');
  });

  it('builds registries from composed pack without unresolved dependency content', () => {
    const shared = minimalDomainPack({
      packId: 'shared-lib',
      packVersion: '1.0.0',
      vocabulary: [{ id: 'term-shared' }],
    });
    const root = minimalDomainPack({
      dependencies: { extends: [], overlay: [], shared: [packToDependencyRef(shared)] },
    });
    const composed = composeDomainPack(root, new Map([[`${shared.packId}\u0000${shared.packVersion}\u0000${packToDependencyRef(shared).packContentHash}`, shared]]));
    const registries = createPackRegistries(composed.pack);
    expect(() => registries.validateCrossReferences()).not.toThrow();
    expect(registries.vocabulary.has('term-shared')).toBe(true);
  });

  it('rejects registry reference assertion for unknown id', () => {
    const registry = buildRegistry('facts', [{ id: 'fact-001', description: 'Fact' }]);
    expect(() =>
      assertRegistryReferences('pack.facts', ['fact-001', 'missing-fact'], registry),
    ).toThrow(RegistryError);
  });
});
