import { describe, it, expect } from 'vitest';
import { computeFixtureCorpusHash, computeFixtureFingerprint } from './corpus-hash.js';
import { minimalFixtureCorpus, minimalFixtureDefinition, minimalGoldFact } from './test-helpers.js';

describe('fixture hashing', () => {
  it('produces deterministic fixture fingerprint', () => {
    const fixture = minimalFixtureDefinition();
    expect(computeFixtureFingerprint(fixture)).toBe(computeFixtureFingerprint(fixture));
  });

  it('changes fingerprint when gold expectations change', () => {
    const before = computeFixtureFingerprint(minimalFixtureDefinition());
    const after = computeFixtureFingerprint(
      minimalFixtureDefinition({
        goldFacts: [
          minimalGoldFact({
            expectation: {
              kind: 'present',
              outcomes: [{ kind: 'value', value: { kind: 'date', value: '2025-01-01' } }],
            },
          }),
        ],
      }),
    );
    expect(before).not.toBe(after);
  });

  it('produces deterministic corpus hash', () => {
    const corpus = minimalFixtureCorpus();
    expect(computeFixtureCorpusHash(corpus)).toBe(computeFixtureCorpusHash(corpus));
  });

  it('changes corpus hash when fixture set changes', () => {
    const base = minimalFixtureCorpus();
    const changed = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({ id: 'fixture-002' }),
      ],
    });
    expect(computeFixtureCorpusHash(base)).not.toBe(computeFixtureCorpusHash(changed));
  });
});
