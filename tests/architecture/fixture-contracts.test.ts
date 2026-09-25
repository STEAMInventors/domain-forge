import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { isProposedFixtureBundle } from '@domain-forge/fixtures';

const ROOT = join(import.meta.dirname, '../..');
const PACK_CONTRACT = join(ROOT, 'packages/pack-contract/src');
const FIXTURES_PKG = join(ROOT, 'packages/fixtures/src');

describe('architecture: fixture and gold contracts', () => {
  it('@hive/pack-contract fixture reference schema does not import Forge packages', () => {
    const file = join(PACK_CONTRACT, 'fixture-reference-v0.ts');
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/@domain-forge\//);
  });

  it('fixture validation package contains no domain-specific constants', () => {
    const forbidden = ['IEP', 'Medicaid', 'BIP'];
    const file = join(FIXTURES_PKG, 'fixture-validation.ts');
    const content = readFileSync(file, 'utf8');
    for (const term of forbidden) {
      expect(content).not.toContain(term);
    }
  });

  it('proposed fixture bundle cannot masquerade as approved gold', () => {
    expect(
      isProposedFixtureBundle({
        source: 'MODEL',
        proposalId: 'prop-001',
        domainId: 'domain-neutral-test',
        fixtures: [],
        cases: [],
      }),
    ).toBe(false);

    expect(
      isProposedFixtureBundle({
        source: 'APPROVED',
        fixtureCorpusHash: 'a'.repeat(64),
        corpus: {
          corpusId: 'corpus-001',
          domainId: 'domain-neutral-test',
          cases: [],
          standaloneFixtures: [],
        },
      }),
    ).toBe(false);
  });

  it('contracts package exports fixture types without Forge runtime imports in pack-contract', () => {
    const contractsFile = join(ROOT, 'packages/contracts/src/fixtures.ts');
    const content = readFileSync(contractsFile, 'utf8');
    expect(content).not.toMatch(/FakeHive|ExtractionQualification|RuleQualification/);
  });
});
