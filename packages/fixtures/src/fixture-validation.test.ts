import { describe, it, expect } from 'vitest';
import { asSourceId, createPackRegistries } from '@domain-forge/core';
import { computePackContentHash } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  assertAcceptedFixtureCorpus,
  isProposedFixtureBundle,
  validateFixtureCorpus,
  validateFixtureDefinition,
  validateProposedFixtureBundle,
} from './fixture-validation.js';
import { buildAcceptedFixtureCorpus, computeFixtureCorpusHash } from './corpus-hash.js';
import { minimalFixtureCorpus, minimalFixtureDefinition, minimalGoldFact } from './test-helpers.js';

const SOURCE_FP = 'a'.repeat(64);

function buildContext(pack = createMinimalTestPack()) {
  return {
    resolveSource: (id: string) =>
      id === 'src-fixture-001'
        ? { sourceContentFingerprint: SOURCE_FP }
        : undefined,
    packContentHash: computePackContentHash(pack),
    packId: pack.packId,
    packVersion: pack.packVersion,
    schemaVersion: pack.schemaVersion,
    domainId: pack.domainId,
  };
}

describe('validateFixtureDefinition', () => {
  it('accepts valid fixture', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition(),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(true);
  });

  it('rejects malformed fixture', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      { id: '' },
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('FIXTURE_MALFORMED');
  });

  it('rejects duplicate fixture id within corpus validation', () => {
    const pack = createMinimalTestPack();
    const duplicate = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({ id: 'dup' }),
        minimalFixtureDefinition({ id: 'dup' }),
      ],
    });
    const result = validateFixtureCorpus(
      duplicate,
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'FIXTURE_DUPLICATE_ID')).toBe(true);
  });

  it('rejects missing source', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({
        sourceBindings: [
          {
            sourceId: asSourceId('missing-source'),
            sourceContentFingerprint: SOURCE_FP,
            documentTypeId: 'doc-type-001',
          },
        ],
      }),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'FIXTURE_SOURCE_MISSING')).toBe(true);
  });

  it('rejects source fingerprint mismatch', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({
        sourceBindings: [
          {
            sourceId: asSourceId('src-fixture-001'),
            sourceContentFingerprint: 'b'.repeat(64),
            documentTypeId: 'doc-type-001',
          },
        ],
      }),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'FIXTURE_FINGERPRINT_MISMATCH')).toBe(true);
  });

  it('resolves document type references', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({ applicableDocumentTypeIds: ['missing-doc'] }),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'GOLD_REFERENCE_UNRESOLVED')).toBe(true);
  });

  it('rejects duplicate gold fact id', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({
        goldFacts: [minimalGoldFact({ id: 'dup' }), minimalGoldFact({ id: 'dup' })],
      }),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'GOLD_FACT_DUPLICATE_ID')).toBe(true);
  });

  it('rejects invalid gold fact reference', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({
        goldFacts: [minimalGoldFact({ extractionContractId: 'missing-contract' })],
      }),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'GOLD_REFERENCE_UNRESOLVED')).toBe(true);
  });

  it('rejects pack incompatibility for pinned pack hash', () => {
    const pack = createMinimalTestPack();
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({
        packCompatibility: {
          mode: 'pinned_pack',
          packId: pack.packId,
          packVersion: pack.packVersion,
          packContentHash: 'c'.repeat(64),
        },
      }),
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'FIXTURE_INCOMPATIBLE_WITH_PACK')).toBe(true);
  });
});

describe('proposed vs approved boundary', () => {
  it('recognizes proposed fixture bundle', () => {
    expect(
      isProposedFixtureBundle({
        source: 'MODEL',
        proposalId: 'prop-001',
        domainId: 'domain-neutral-test',
        fixtures: [minimalFixtureDefinition()],
      }),
    ).toBe(true);
  });

  it('validates proposed fixture bundle schema only', () => {
    const result = validateProposedFixtureBundle({
      source: 'MODEL',
      proposalId: 'prop-001',
      domainId: 'domain-neutral-test',
      fixtures: [minimalFixtureDefinition()],
    });
    expect(result.valid).toBe(true);
  });

  it('builds accepted corpus with deterministic hash', () => {
    const corpus = minimalFixtureCorpus();
    const accepted = buildAcceptedFixtureCorpus(corpus);
    expect(accepted.source).toBe('APPROVED');
    expect(accepted.fixtureCorpusHash).toBe(computeFixtureCorpusHash(corpus));
  });

  it('detects corpus mismatch', () => {
    const corpus = minimalFixtureCorpus();
    const result = assertAcceptedFixtureCorpus(corpus, 'f'.repeat(64));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('CORPUS_MISMATCH');
  });
});

describe('multi-source fixture case', () => {
  it('validates fixture case with multiple sources', () => {
    const pack = createMinimalTestPack();
    const corpus = minimalFixtureCorpus({
      cases: [
        {
          id: 'case-001',
          domainId: 'domain-neutral-test',
          tags: ['multi-doc'],
          fixtures: [
            minimalFixtureDefinition({
              id: 'fixture-doc-a',
              sourceBindings: [
                {
                  sourceId: asSourceId('src-fixture-001'),
                  sourceContentFingerprint: SOURCE_FP,
                  documentTypeId: 'doc-type-001',
                  temporalRole: 'historical',
                },
              ],
            }),
            minimalFixtureDefinition({
              id: 'fixture-doc-b',
              sourceBindings: [
                {
                  sourceId: asSourceId('src-fixture-001'),
                  sourceContentFingerprint: SOURCE_FP,
                  documentTypeId: 'doc-type-001',
                  temporalRole: 'current',
                },
              ],
              goldFacts: [],
              expectedRuleOutcomes: [],
            }),
          ],
          crossDocumentGoldFacts: [minimalGoldFact({ id: 'gold-cross-001' })],
          temporalRelationships: [
            {
              fromSourceId: asSourceId('src-fixture-001'),
              toSourceId: asSourceId('src-fixture-001'),
              relationship: 'supersedes',
            },
          ],
          forbiddenExpectations: [{ kind: 'rule_fired', ruleId: 'rule-001' }],
        },
      ],
      standaloneFixtures: [],
    });

    const result = validateFixtureCorpus(
      corpus,
      createPackRegistries(pack),
      buildContext(pack),
    );
    expect(result.valid).toBe(true);
  });
});
