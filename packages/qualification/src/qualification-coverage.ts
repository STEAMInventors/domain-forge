import type {
  FixtureExecutionResult,
  QualificationCoverageMetrics,
} from '@domain-forge/contracts';

function isPassed(result: FixtureExecutionResult): boolean {
  if (result.executionStatus !== 'completed') return false;
  if (result.goldEvaluation === undefined) return false;
  return result.goldEvaluation.passed;
}

/** Deterministic coverage from immutable fixture execution records — no model self-reporting. */
export function computeQualificationCoverage(
  fixtureResults: readonly FixtureExecutionResult[],
): QualificationCoverageMetrics {
  const byCategory: Record<string, { total: number; executed: number; passed: number }> = {};

  let executedFixtures = 0;
  let passedFixtures = 0;
  let failedFixtures = 0;
  let incompleteFixtures = 0;
  let skippedFixtures = 0;

  let syntheticTotal = 0;
  let syntheticExecuted = 0;
  let syntheticPassed = 0;
  let realCorpusTotal = 0;
  let realCorpusExecuted = 0;
  let realCorpusPassed = 0;

  for (const result of fixtureResults) {
    const category = result.fixtureCategory;
    byCategory[category] ??= { total: 0, executed: 0, passed: 0 };
    byCategory[category].total += 1;

    if (result.materialClass === 'synthetic') syntheticTotal += 1;
    else realCorpusTotal += 1;

    if (result.executionStatus === 'skipped') {
      skippedFixtures += 1;
      continue;
    }

    if (result.executionStatus === 'incomplete' || result.executionStatus === 'blocked') {
      incompleteFixtures += 1;
      continue;
    }

    executedFixtures += 1;
    byCategory[category].executed += 1;

    if (result.materialClass === 'synthetic') syntheticExecuted += 1;
    else realCorpusExecuted += 1;

    if (isPassed(result)) {
      passedFixtures += 1;
      byCategory[category].passed += 1;
      if (result.materialClass === 'synthetic') syntheticPassed += 1;
      else realCorpusPassed += 1;
    } else {
      failedFixtures += 1;
    }
  }

  return {
    totalFixtures: fixtureResults.length,
    executedFixtures,
    passedFixtures,
    failedFixtures,
    incompleteFixtures,
    skippedFixtures,
    syntheticTotal,
    syntheticExecuted,
    syntheticPassed,
    realCorpusTotal,
    realCorpusExecuted,
    realCorpusPassed,
    byCategory,
  };
}
