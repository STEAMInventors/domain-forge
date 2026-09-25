import { describe, it, expect } from 'vitest';
import {
  buildRegistry,
  assertRegistryReferences,
  PrimitiveRegistry,
  GrammarRegistry,
  ArchetypeRegistry,
  CompositionRegistry,
  TimeModelRegistry,
  IdentityStrategyRegistry,
  RuleOutcomeRegistry,
  OutputSectionTypeRegistry,
  SourceTierRegistry,
  ReviewerRoleRegistry,
  isBannedQuestionLanguage,
  acceptQuestionLanguageEntry,
  createPackRegistries,
  RegistryError,
} from './index.js';
import { composeDomainPack, computePackContentHash } from '@hive/pack-contract';
import type { DomainPackV0 } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';

describe('buildRegistry', () => {
  it('creates a valid immutable registry', () => {
    const registry = buildRegistry('test', [{ id: 'a', description: 'Entry A' }]);
    expect(registry.resolve('a').id).toBe('a');
    expect(registry.list()).toHaveLength(1);
  });

  it('lists entries in deterministic id order', () => {
    const registry = buildRegistry('test', [
      { id: 'c', description: 'C' },
      { id: 'a', description: 'A' },
      { id: 'b', description: 'B' },
    ]);
    expect(registry.list().map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('rejects duplicate canonical ids', () => {
    expect(() =>
      buildRegistry('test', [
        { id: 'dup', description: 'One' },
        { id: 'dup', description: 'Two' },
      ]),
    ).toThrow(RegistryError);
  });

  it('resolves explicit aliases', () => {
    const registry = buildRegistry('test', [
      { id: 'canonical', description: 'Canonical', aliases: ['alias-a'] },
    ]);
    expect(registry.resolve('alias-a').id).toBe('canonical');
    expect(registry.assert('alias-a')).toBe('canonical');
  });

  it('rejects duplicate aliases', () => {
    expect(() =>
      buildRegistry('test', [
        { id: 'one', description: 'One', aliases: ['shared'] },
        { id: 'two', description: 'Two', aliases: ['shared'] },
      ]),
    ).toThrow(RegistryError);
  });

  it('rejects unknown entries', () => {
    const registry = buildRegistry('test', [{ id: 'known', description: 'Known' }]);
    expect(() => registry.resolve('missing')).toThrow(RegistryError);
    expect(registry.has('missing')).toBe(false);
  });

  it('rejects malformed entries', () => {
    expect(() => buildRegistry('test', [{ id: '', description: 'Bad' }])).toThrow(RegistryError);
  });

  it('produces stable fingerprints', () => {
    const a = buildRegistry('test', [{ id: 'x', description: 'X' }]);
    const b = buildRegistry('test', [{ id: 'x', description: 'X' }]);
    expect(a.getFingerprint()).toBe(b.getFingerprint());
  });

  it('validates cross-references', () => {
    expect(() => assertRegistryReferences('source', ['REQUIRE'], PrimitiveRegistry)).not.toThrow();
    expect(() => assertRegistryReferences('source', ['INVALID'], PrimitiveRegistry)).toThrow(RegistryError);
  });
});

describe('system registries', () => {
  it('registers all architecture-defined primitives in deterministic order', () => {
    expect(PrimitiveRegistry.list().map((e) => e.id)).toEqual([
      'COMPARE',
      'CONSISTENT',
      'LINK',
      'REQUIRE',
      'SERIES',
      'WINDOW',
    ]);
  });

  it('registers grammar types', () => {
    expect(GrammarRegistry.has('Party')).toBe(true);
    expect(GrammarRegistry.has('InvalidGrammar')).toBe(false);
  });

  it('registers archetypes', () => {
    expect(ArchetypeRegistry.assert('ledger')).toBe('ledger');
  });

  it('registers composition strategies', () => {
    expect(CompositionRegistry.assert('snapshot')).toBe('snapshot');
  });

  it('registers time models', () => {
    expect(TimeModelRegistry.assert('calendar_day')).toBe('calendar_day');
  });

  it('registers identity strategies', () => {
    expect(IdentityStrategyRegistry.assert('external_id')).toBe('external_id');
  });

  it('registers rule outcomes', () => {
    expect(RuleOutcomeRegistry.assert('UNDETERMINED')).toBe('UNDETERMINED');
  });

  it('registers output section types in deterministic order', () => {
    expect(OutputSectionTypeRegistry.list().map((e) => e.id)).toEqual([
      'CASE_SNAPSHOT',
      'DOCUMENT_REQUESTS',
      'ENTITY_TABLE',
      'FINDINGS_LIST',
      'QUESTION_LIST',
      'TIMELINE',
    ]);
  });

  it('registers source tiers 1-6', () => {
    expect(SourceTierRegistry.list()).toHaveLength(6);
    expect(SourceTierRegistry.assert('1')).toBe('1');
  });

  it('registers reviewer roles', () => {
    expect(ReviewerRoleRegistry.has('DOMAIN_EXPERT')).toBe(true);
    expect(ReviewerRoleRegistry.has('RANDOM_ROLE')).toBe(false);
  });
});

describe('QuestionLanguageRegistry', () => {
  it('detects banned phrases deterministically', () => {
    expect(isBannedQuestionLanguage('You will always qualify')).toBe(true);
    expect(isBannedQuestionLanguage('What is the status?')).toBe(false);
  });

  it('rejects malformed proposed entries', () => {
    expect(() =>
      acceptQuestionLanguageEntry({
        id: '',
        phrase: 'bad',
        restriction: 'banned',
        reason: 'test',
        description: 'test',
      }),
    ).toThrow(RegistryError);
  });
});

function registryTestPack(overrides?: Partial<DomainPackV0>): DomainPackV0 {
  return createMinimalTestPack(overrides);
}

describe('createPackRegistries', () => {
  it('builds registries from composed pack content', () => {
    const pack = registryTestPack();
    const registries = createPackRegistries(pack);
    expect(registries.entities.resolve('entity-001').grammarType).toBe('Party');
    expect(registries.rules.has('rule-001')).toBe(true);
  });

  it('lists pack entries deterministically', () => {
    const pack = registryTestPack({
      entities: [
        { id: 'z-entity', grammarType: 'Party' },
        { id: 'a-entity', grammarType: 'Claim' },
      ],
    });
    const registries = createPackRegistries(pack);
    expect(registries.entities.list().map((e) => e.id)).toEqual(['a-entity', 'z-entity']);
  });

  it('rejects duplicate pack entry ids', () => {
    const pack = registryTestPack({
      entities: [
        { id: 'dup', grammarType: 'Party' },
        { id: 'dup', grammarType: 'Claim' },
      ],
    });
    expect(() => createPackRegistries(pack)).toThrow(RegistryError);
  });

  it('rejects unknown entry lookup', () => {
    const registries = createPackRegistries(registryTestPack());
    expect(() => registries.facts.resolve('missing')).toThrow(RegistryError);
  });

  it('validates dangling cross-references', () => {
    const registries = createPackRegistries(
      registryTestPack({
        facts: [{ id: 'fact-001', entityId: 'missing-entity' }],
      }),
    );
    expect(() => registries.validateCrossReferences()).toThrow(RegistryError);
  });

  it('validates rule primitive references', () => {
    const registries = createPackRegistries(
      registryTestPack({
        rules: [
          {
            id: 'rule-bad',
            primitive: 'INVENTED',
            entityIds: [],
            factIds: [],
            authorityRefIds: [],
          },
        ],
      }),
    );
    expect(() => registries.validateCrossReferences()).toThrow(RegistryError);
  });

  it('produces equivalent registries from same composed pack', () => {
    const base = createMinimalTestPack({ packId: 'base', packVersion: '1.0.0', rules: [], entities: [], facts: [] });
    const root = registryTestPack({
      dependencies: {
        extends: [
          {
            packId: base.packId,
            packVersion: base.packVersion,
            packContentHash: computePackContentHash(base),
          },
        ],
        overlay: [],
        shared: [],
      },
    });
    const resolutionSet = new Map([[computePackContentHash(base), base]]);
    const composed = composeDomainPack(root, resolutionSet);
    const a = createPackRegistries(composed.pack);
    const b = createPackRegistries(composed.pack);
    expect(a.getFingerprint()).toBe(b.getFingerprint());
  });
});
