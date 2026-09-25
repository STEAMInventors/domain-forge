import { describe, it, expect } from 'vitest';
import { asSourceId, createPackRegistries } from '@domain-forge/core';
import { computePackContentHash } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  buildAcceptedFixtureCorpus,
  computeFixtureCorpusHash,
  computeFixtureFingerprint,
  evaluateGoldExpectations,
  isProposedFixtureBundle,
  validateFixtureCorpus,
  validateFixtureDefinition,
} from '@domain-forge/fixtures';
import { minimalFixtureCorpus, minimalFixtureDefinition, minimalGoldFact } from '@domain-forge/fixtures';
import type { AcceptedExtraction } from '@domain-forge/contracts';
import { ACCEPTED_EXTRACTION_BRAND } from '@domain-forge/contracts';

const SOURCE_FP = 'a'.repeat(64);

function buildContext(pack = createMinimalTestPack()) {
  return {
    resolveSource: (id: string) =>
      id === 'src-fixture-001' ? { sourceContentFingerprint: SOURCE_FP } : undefined,
    packContentHash: computePackContentHash(pack),
    packId: pack.packId,
    packVersion: pack.packVersion,
    schemaVersion: pack.schemaVersion,
    domainId: pack.domainId,
  };
}

function fakeAcceptedExtraction(overrides: Partial<AcceptedExtraction> = {}): AcceptedExtraction {
  return {
    [ACCEPTED_EXTRACTION_BRAND]: true,
    source: 'VALIDATED',
    contractId: 'extract-fact-001',
    factId: 'fact-001',
    contractEntryId: 'extract-fact-001',
    expectedType: 'date',
    cardinality: 'exactly_one',
    outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
    documentTypeId: 'doc-type-001',
    evidence: [],
    extractionHash: 'a'.repeat(64),
    contractContentHash: 'b'.repeat(64),
    ...overrides,
  };
}

describe('adversarial: fixture and gold truth', () => {
  it('detects source fingerprint mismatch on fixture binding', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
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
      registries,
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'FIXTURE_FINGERPRINT_MISMATCH')).toBe(true);
  });

  it('detects duplicate gold fact ids in same fixture', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
    const result = validateFixtureDefinition(
      minimalFixtureDefinition({
        goldFacts: [minimalGoldFact({ id: 'gold-dup' }), minimalGoldFact({ id: 'gold-dup' })],
      }),
      registries,
      buildContext(pack),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'GOLD_FACT_DUPLICATE_ID')).toBe(true);
  });

  it('detects contradictory gold expectations when forbidden extraction is produced', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [],
          forbiddenExpectations: [{ kind: 'fact', factId: 'fact-001', contractId: 'extract-fact-001' }],
        }),
      ],
    });
    const result = evaluateGoldExpectations(
      { extractions: [fakeAcceptedExtraction()], ruleOutcomes: [], claims: [], narratives: [] },
      corpus,
    );
    expect(result.passed).toBe(false);
    expect(result.findings.some((f) => f.status === 'forbidden_artifact_produced')).toBe(true);
  });

  it('detects NOT_PRESENT expected but value produced', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [minimalGoldFact({ expectation: { kind: 'missingness', state: 'NOT_PRESENT' } })],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const result = evaluateGoldExpectations(
      { extractions: [fakeAcceptedExtraction()], ruleOutcomes: [], claims: [], narratives: [] },
      corpus,
    );
    expect(result.passed).toBe(false);
    expect(result.findings.some((f) => f.status === 'incorrect_missingness')).toBe(true);
  });

  it('rejects fixture pinned to wrong pack content hash', () => {
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

  it('changes fixtureCorpusHash when fixture content changes', () => {
    const corpusA = minimalFixtureCorpus();
    const corpusB = minimalFixtureCorpus({
      standaloneFixtures: [minimalFixtureDefinition({ id: 'fixture-modified' })],
    });
    expect(computeFixtureCorpusHash(corpusA)).not.toBe(computeFixtureCorpusHash(corpusB));
  });

  it('rejects proposed fixture bundle masquerading as approved corpus', () => {
    expect(
      isProposedFixtureBundle({
        source: 'APPROVED',
        fixtureCorpusHash: 'a'.repeat(64),
        corpus: minimalFixtureCorpus(),
      }),
    ).toBe(false);
  });

  it('detects fixture fingerprint change when source binding changes', () => {
    const fixture = minimalFixtureDefinition();
    const tampered = minimalFixtureDefinition({
      sourceBindings: [
        {
          sourceId: asSourceId('src-fixture-001'),
          sourceContentFingerprint: 'tampered-fingerprint'.padEnd(64, '0'),
          documentTypeId: 'doc-type-001',
        },
      ],
    });
    expect(computeFixtureFingerprint(fixture)).not.toBe(computeFixtureFingerprint(tampered));
  });

  it('validates accepted fixture corpus through validation boundary', () => {
    const pack = createMinimalTestPack();
    const corpus = minimalFixtureCorpus();
    const accepted = buildAcceptedFixtureCorpus(corpus);
    expect(accepted.source).toBe('APPROVED');
    const validation = validateFixtureCorpus(corpus, createPackRegistries(pack), buildContext(pack));
    expect(validation.valid).toBe(true);
  });
});
