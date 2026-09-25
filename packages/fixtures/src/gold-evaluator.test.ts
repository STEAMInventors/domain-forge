import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import type {
  AcceptedExtraction,
  GoldEvaluationInput,
  RuleOutcomeRecord,
  ValidatedClaim,
} from '@domain-forge/contracts';
import { ACCEPTED_EXTRACTION_BRAND } from '@domain-forge/contracts';
import { evaluateGoldExpectations } from './gold-evaluator.js';
import { minimalFixtureCorpus, minimalFixtureDefinition, minimalGoldFact } from './test-helpers.js';

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

function baseInput(overrides: Partial<GoldEvaluationInput> = {}): GoldEvaluationInput {
  return {
    extractions: [],
    ruleOutcomes: [],
    claims: [],
    narratives: [],
    ...overrides,
  };
}

describe('evaluateGoldExpectations', () => {
  it('matches positive expected extraction', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [
            minimalGoldFact({
              expectation: {
                kind: 'present',
                outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
              },
            }),
          ],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const result = evaluateGoldExpectations(
      baseInput({ extractions: [fakeAcceptedExtraction()] }),
      corpus,
    );
    expect(result.passed).toBe(true);
  });

  it('detects value mismatch', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const result = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            outcomes: [{ kind: 'value', value: { kind: 'date', value: '2025-06-01' } }],
          }),
        ],
      }),
      corpus,
    );
    expect(result.passed).toBe(false);
    expect(result.findings.some((f) => f.status === 'mismatch')).toBe(true);
  });

  it('distinguishes zero from missing for numeric facts', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [
            minimalGoldFact({
              expectation: {
                kind: 'present',
                outcomes: [{ kind: 'value', value: { kind: 'number', value: 0 } }],
              },
            }),
          ],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const passResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            expectedType: 'number',
            outcomes: [{ kind: 'value', value: { kind: 'number', value: 0 } }],
          }),
        ],
      }),
      corpus,
    );
    expect(passResult.passed).toBe(true);

    const failResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            expectedType: 'number',
            outcomes: [{ kind: 'missingness', state: 'NOT_PRESENT' }],
          }),
        ],
      }),
      corpus,
    );
    expect(failResult.passed).toBe(false);
    expect(failResult.findings.some((f) => f.status === 'incorrect_missingness')).toBe(true);
  });

  it('distinguishes false from missing for boolean facts', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [
            minimalGoldFact({
              expectation: {
                kind: 'present',
                outcomes: [{ kind: 'value', value: { kind: 'boolean', value: false } }],
              },
            }),
          ],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const passResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            expectedType: 'boolean',
            outcomes: [{ kind: 'value', value: { kind: 'boolean', value: false } }],
          }),
        ],
      }),
      corpus,
    );
    expect(passResult.passed).toBe(true);
  });

  it('enforces NOT_PRESENT missingness', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [
            minimalGoldFact({
              expectation: { kind: 'missingness', state: 'NOT_PRESENT' },
            }),
          ],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const passResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            outcomes: [{ kind: 'missingness', state: 'NOT_PRESENT' }],
          }),
        ],
      }),
      corpus,
    );
    expect(passResult.passed).toBe(true);

    const failResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
          }),
        ],
      }),
      corpus,
    );
    expect(failResult.passed).toBe(false);
  });

  it('enforces UNDETERMINED missingness', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [
            minimalGoldFact({
              expectation: { kind: 'missingness', state: 'UNDETERMINED' },
            }),
          ],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const passResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            outcomes: [{ kind: 'missingness', state: 'UNDETERMINED' }],
          }),
        ],
      }),
      corpus,
    );
    expect(passResult.passed).toBe(true);

    const failResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            outcomes: [{ kind: 'missingness', state: 'NOT_PRESENT' }],
          }),
        ],
      }),
      corpus,
    );
    expect(failResult.passed).toBe(false);
    expect(failResult.findings.some((f) => f.status === 'incorrect_missingness')).toBe(true);
  });

  it('detects forbidden unexpected extraction', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [minimalGoldFact({ expectation: { kind: 'forbidden' } })],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const passResult = evaluateGoldExpectations(baseInput(), corpus);
    expect(passResult.passed).toBe(true);

    const failResult = evaluateGoldExpectations(
      baseInput({ extractions: [fakeAcceptedExtraction()] }),
      corpus,
    );
    expect(failResult.passed).toBe(false);
    expect(failResult.findings.some((f) => f.status === 'forbidden_artifact_produced')).toBe(true);
  });

  it('evaluates expected rule FIRED', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [],
          expectedRuleOutcomes: [{ ruleId: 'rule-001', outcome: 'FIRED' }],
        }),
      ],
    });
    const ruleOutcomes: RuleOutcomeRecord[] = [
      { ruleId: 'rule-001', outcome: 'FIRED', outcomeHash: 'c'.repeat(64) },
    ];
    const result = evaluateGoldExpectations(baseInput({ ruleOutcomes }), corpus);
    expect(result.passed).toBe(true);
  });

  it('evaluates expected NOT_FIRED', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [],
          expectedRuleOutcomes: [{ ruleId: 'rule-001', outcome: 'NOT_FIRED' }],
        }),
      ],
    });
    const result = evaluateGoldExpectations(
      baseInput({
        ruleOutcomes: [{ ruleId: 'rule-001', outcome: 'NOT_FIRED', outcomeHash: 'd'.repeat(64) }],
      }),
      corpus,
    );
    expect(result.passed).toBe(true);
  });

  it('evaluates expected UNDETERMINED', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [],
          expectedRuleOutcomes: [{ ruleId: 'rule-001', outcome: 'UNDETERMINED' }],
        }),
      ],
    });
    const result = evaluateGoldExpectations(
      baseInput({
        ruleOutcomes: [{ ruleId: 'rule-001', outcome: 'UNDETERMINED', outcomeHash: 'e'.repeat(64) }],
      }),
      corpus,
    );
    expect(result.passed).toBe(true);
  });

  it('matches evidence expectation by canonical binding', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [
            minimalGoldFact({
              expectedEvidence: [
                {
                  sourceId: asSourceId('src-evidence-001'),
                  sourceContentFingerprint: 'f'.repeat(64),
                  locator: { kind: 'page', page: 1 },
                  quoteVerified: true,
                  normalizedQuote: 'January 1, 2024',
                },
              ],
            }),
          ],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [],
        }),
      ],
    });
    const passResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            evidence: [
              {
                source: 'VALIDATED',
                evidenceId: 'ev-001' as never,
                sourceId: asSourceId('src-evidence-001'),
                sourceContentFingerprint: 'f'.repeat(64),
                locator: { kind: 'page', page: 1 },
                quoteVerified: true,
                normalizedQuote: 'January 1, 2024',
                evidenceReferenceHash: 'g'.repeat(64),
              },
            ],
          }),
        ],
      }),
      corpus,
    );
    expect(passResult.passed).toBe(true);

    const failResult = evaluateGoldExpectations(
      baseInput({
        extractions: [
          fakeAcceptedExtraction({
            evidence: [
              {
                source: 'VALIDATED',
                evidenceId: 'ev-001' as never,
                sourceId: asSourceId('src-evidence-001'),
                sourceContentFingerprint: 'f'.repeat(64),
                locator: { kind: 'page', page: 2 },
                quoteVerified: true,
                evidenceReferenceHash: 'g'.repeat(64),
              },
            ],
          }),
        ],
      }),
      corpus,
    );
    expect(failResult.passed).toBe(false);
    expect(failResult.findings.some((f) => f.status === 'incorrect_evidence')).toBe(true);
  });

  it('asserts forbidden claim must not exist', () => {
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [
        minimalFixtureDefinition({
          goldFacts: [],
          expectedRuleOutcomes: [],
          forbiddenExpectations: [{ kind: 'claim', claimTypeId: 'claim-finding-001' }],
        }),
      ],
    });
    const claims = [
      {
        claimTypeId: 'claim-finding-001',
      },
    ] as ValidatedClaim[];

    const failResult = evaluateGoldExpectations(baseInput({ claims }), corpus);
    expect(failResult.passed).toBe(false);
  });
});
