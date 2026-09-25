import type {
  AcceptedEvidenceReference,
  AcceptedExtraction,
  EvidenceLocator,
  FixtureCorpus,
  FixtureDefinition,
  ForbiddenExpectation,
  GoldEvaluationFinding,
  GoldEvaluationInput,
  GoldEvaluationResult,
  GoldEvidenceExpectation,
  GoldFact,
} from '@domain-forge/contracts';
import { extractionOutcomesEqual } from './extraction-value-equality.js';

function finding(
  status: GoldEvaluationFinding['status'],
  message: string,
  extras: Partial<GoldEvaluationFinding> = {},
): GoldEvaluationFinding {
  return { status, message, ...extras };
}

function locatorsEqual(a: EvidenceLocator, b: EvidenceLocator): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'page':
      return a.page === (b as typeof a).page;
    case 'line_range':
      return (
        a.startLine === (b as typeof a).startLine && a.endLine === (b as typeof a).endLine
      );
    case 'section':
      return a.heading === (b as typeof a).heading && a.level === (b as typeof a).level;
    case 'paragraph':
      return a.index === (b as typeof a).index;
    case 'character_span':
      return (
        a.startOffset === (b as typeof a).startOffset &&
        a.endOffset === (b as typeof a).endOffset
      );
    case 'field_path':
      return a.path === (b as typeof a).path;
    case 'fragment':
      return a.fragmentId === (b as typeof a).fragmentId;
    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

function evidenceMatchesExpectation(
  expected: GoldEvidenceExpectation,
  actual: AcceptedEvidenceReference,
): boolean {
  if (actual.sourceId !== expected.sourceId) return false;
  if (actual.sourceContentFingerprint !== expected.sourceContentFingerprint) return false;
  if (!locatorsEqual(actual.locator, expected.locator)) return false;
  if (expected.quoteVerified !== undefined && actual.quoteVerified !== expected.quoteVerified) {
    return false;
  }
  if (expected.normalizedQuote !== undefined) {
    const actualNorm = actual.normalizedQuote ?? actual.content?.normalizedText;
    if (actualNorm !== expected.normalizedQuote) return false;
  }
  return true;
}

function findExtraction(
  input: GoldEvaluationInput,
  gold: GoldFact,
): AcceptedExtraction | undefined {
  return input.extractions.find(
    (e) =>
      e.factId === gold.factId &&
      e.contractId === gold.extractionContractId &&
      (gold.entityId === undefined || e.entityId === gold.entityId) &&
      (gold.documentTypeId === undefined || e.documentTypeId === gold.documentTypeId),
  );
}

function evaluateGoldFact(gold: GoldFact, input: GoldEvaluationInput): GoldEvaluationFinding[] {
  const findings: GoldEvaluationFinding[] = [];
  const actual = findExtraction(input, gold);
  const path = `goldFacts.${gold.id}`;

  switch (gold.expectation.kind) {
    case 'forbidden':
      if (actual !== undefined) {
        findings.push(
          finding(
            'forbidden_artifact_produced',
            `Forbidden extraction produced for fact ${gold.factId}`,
            { goldFactId: gold.id, path },
          ),
        );
      } else {
        findings.push(finding('match', `Forbidden fact ${gold.factId} correctly absent`, { goldFactId: gold.id }));
      }
      return findings;
    case 'missingness': {
      if (actual === undefined) {
        findings.push(
          finding('missing', `Expected missingness ${gold.expectation.state} but extraction absent`, {
            goldFactId: gold.id,
            path,
          }),
        );
        return findings;
      }
      const missingOutcome = actual.outcomes.find((o) => o.kind === 'missingness');
      if (missingOutcome === undefined || missingOutcome.kind !== 'missingness') {
        findings.push(
          finding(
            'incorrect_missingness',
            `Expected missingness ${gold.expectation.state} but got value outcome`,
            { goldFactId: gold.id, path },
          ),
        );
        return findings;
      }
      if (missingOutcome.state !== gold.expectation.state) {
        findings.push(
          finding(
            'incorrect_missingness',
            `Expected ${gold.expectation.state}, got ${missingOutcome.state}`,
            { goldFactId: gold.id, path },
          ),
        );
        return findings;
      }
      if (gold.expectation.state === 'NOT_PRESENT' && actual.outcomes.some((o) => o.kind === 'value')) {
        findings.push(
          finding(
            'incorrect_missingness',
            'NOT_PRESENT expected but value outcome present',
            { goldFactId: gold.id, path },
          ),
        );
      }
      break;
    }
    case 'present': {
      if (actual === undefined) {
        findings.push(
          finding('missing', `Expected present extraction for fact ${gold.factId}`, {
            goldFactId: gold.id,
            path,
          }),
        );
        return findings;
      }
      if (actual.outcomes.some((o) => o.kind === 'missingness')) {
        findings.push(
          finding(
            'incorrect_missingness',
            'Expected value presence but extraction reported missingness',
            { goldFactId: gold.id, path },
          ),
        );
        return findings;
      }
      if (!extractionOutcomesEqual(gold.expectation.outcomes, actual.outcomes)) {
        findings.push(
          finding('mismatch', `Gold fact value mismatch for ${gold.factId}`, {
            goldFactId: gold.id,
            path,
          }),
        );
        return findings;
      }
      break;
    }
    default: {
      const _exhaustive: never = gold.expectation;
      findings.push(
        finding('mismatch', `Unknown gold expectation kind: ${String(_exhaustive)}`, {
          goldFactId: gold.id,
          path,
        }),
      );
      return findings;
    }
  }

  if (gold.expectedEvidence !== undefined && gold.expectedEvidence.length > 0) {
    if (actual === undefined) {
      findings.push(
        finding('incorrect_evidence', 'Cannot verify evidence without extraction', {
          goldFactId: gold.id,
          path,
        }),
      );
      return findings;
    }
    for (const [index, expectedEv] of gold.expectedEvidence.entries()) {
      const matched = actual.evidence.some((ev) => evidenceMatchesExpectation(expectedEv, ev));
      if (!matched) {
        findings.push(
          finding('incorrect_evidence', `Expected evidence[${index}] not satisfied`, {
            goldFactId: gold.id,
            path: `${path}.expectedEvidence[${index}]`,
          }),
        );
      }
    }
  }

  findings.push(finding('match', `Gold fact ${gold.id} satisfied`, { goldFactId: gold.id }));
  return findings;
}

function evaluateForbidden(
  forbidden: ForbiddenExpectation,
  input: GoldEvaluationInput,
): GoldEvaluationFinding {
  switch (forbidden.kind) {
    case 'fact': {
      const produced = input.extractions.some(
        (e) =>
          e.factId === forbidden.factId &&
          (forbidden.contractId === undefined || e.contractId === forbidden.contractId),
      );
      if (produced) {
        return finding('forbidden_artifact_produced', `Forbidden fact ${forbidden.factId} produced`, {
          forbiddenKind: 'fact',
        });
      }
      return finding('match', `Forbidden fact ${forbidden.factId} absent`);
    }
    case 'claim': {
      const produced = input.claims.some((c) => c.claimTypeId === forbidden.claimTypeId);
      if (produced) {
        return finding(
          'forbidden_artifact_produced',
          `Forbidden claim type ${forbidden.claimTypeId} produced`,
          { forbiddenKind: 'claim' },
        );
      }
      return finding('match', `Forbidden claim ${forbidden.claimTypeId} absent`);
    }
    case 'rule_fired': {
      const fired = input.ruleOutcomes.some(
        (r) => r.ruleId === forbidden.ruleId && r.outcome === 'FIRED',
      );
      if (fired) {
        return finding(
          'forbidden_artifact_produced',
          `Forbidden rule ${forbidden.ruleId} fired`,
          { forbiddenKind: 'rule_fired', ruleId: forbidden.ruleId },
        );
      }
      return finding('match', `Forbidden rule fire ${forbidden.ruleId} absent`, {
        ruleId: forbidden.ruleId,
      });
    }
    case 'output_section': {
      if (input.output === undefined) {
        return finding('missing', 'Output required to evaluate forbidden section expectation');
      }
      if (input.output.specificationId !== forbidden.specificationId) {
        return finding('match', 'Different output specification — section forbidden check skipped');
      }
      const present = input.output.sections.some((s) => s.sectionId === forbidden.sectionId);
      if (present) {
        return finding(
          'forbidden_artifact_produced',
          `Forbidden output section ${forbidden.sectionId} present`,
          { forbiddenKind: 'output_section' },
        );
      }
      return finding('match', `Forbidden section ${forbidden.sectionId} absent`);
    }
    case 'narrative': {
      const produced = input.narratives.some(
        (n) =>
          (forbidden.sectionId === undefined || n.sectionId === forbidden.sectionId) &&
          n.text.trim().length > 0,
      );
      if (produced) {
        return finding('forbidden_artifact_produced', 'Forbidden narrative produced', {
          forbiddenKind: 'narrative',
        });
      }
      return finding('match', 'Forbidden narrative absent');
    }
    default: {
      const _exhaustive: never = forbidden;
      return finding('mismatch', `Unknown forbidden expectation: ${String(_exhaustive)}`);
    }
  }
}

function evaluateFixture(fixture: FixtureDefinition, input: GoldEvaluationInput): GoldEvaluationFinding[] {
  const findings: GoldEvaluationFinding[] = [];

  for (const gold of fixture.goldFacts) {
    findings.push(...evaluateGoldFact(gold, input));
  }

  for (const expected of fixture.expectedRuleOutcomes) {
    const actual = input.ruleOutcomes.find((r) => r.ruleId === expected.ruleId);
    if (actual === undefined) {
      findings.push(
        finding('missing', `Expected rule outcome for ${expected.ruleId}`, { ruleId: expected.ruleId }),
      );
      continue;
    }
    if (actual.outcome !== expected.outcome) {
      findings.push(
        finding('mismatch', `Rule ${expected.ruleId}: expected ${expected.outcome}, got ${actual.outcome}`, {
          ruleId: expected.ruleId,
        }),
      );
    } else {
      findings.push(finding('match', `Rule ${expected.ruleId} outcome matched`, { ruleId: expected.ruleId }));
    }
  }

  if (fixture.expectedOutput !== undefined && input.output !== undefined) {
    for (const section of fixture.expectedOutput.sectionPresence ?? []) {
      const present = input.output.sections.some((s) => s.sectionId === section.sectionId);
      if (section.expectation === 'present' && !present) {
        findings.push(
          finding('missing', `Expected section ${section.sectionId} present`, { path: section.sectionId }),
        );
      }
      if (section.expectation === 'absent' && present) {
        findings.push(
          finding(
            'forbidden_artifact_produced',
            `Section ${section.sectionId} must be absent`,
            { path: section.sectionId },
          ),
        );
      }
    }
    for (const claim of fixture.expectedOutput.claimPresence ?? []) {
      const hasClaim = input.claims.some((c) => c.claimTypeId === claim.claimTypeId);
      if (claim.expectation === 'present' && !hasClaim) {
        findings.push(finding('missing', `Expected claim ${claim.claimTypeId} present`));
      }
      if (claim.expectation === 'forbidden' && hasClaim) {
        findings.push(
          finding('forbidden_artifact_produced', `Forbidden claim ${claim.claimTypeId} present`, {
            forbiddenKind: 'claim',
          }),
        );
      }
    }
  }

  for (const forbidden of fixture.forbiddenExpectations) {
    findings.push(evaluateForbidden(forbidden, input));
  }

  return findings;
}

export function evaluateGoldExpectations(
  input: GoldEvaluationInput,
  corpus: FixtureCorpus,
): GoldEvaluationResult {
  const findings: GoldEvaluationFinding[] = [];

  for (const fixture of corpus.standaloneFixtures) {
    findings.push(...evaluateFixture(fixture, input));
  }

  for (const fixtureCase of corpus.cases) {
    for (const fixture of fixtureCase.fixtures) {
      findings.push(...evaluateFixture(fixture, input));
    }
    for (const gold of fixtureCase.crossDocumentGoldFacts) {
      findings.push(...evaluateGoldFact(gold, input));
    }
    for (const forbidden of fixtureCase.forbiddenExpectations) {
      findings.push(evaluateForbidden(forbidden, input));
    }
  }

  const failed = findings.some((f) => f.status !== 'match');

  return {
    passed: !failed,
    findings,
  };
}
