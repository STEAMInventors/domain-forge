import type {
  HiveExecutor,
  HiveExecutionResult,
  SyntheticFixture,
  FixtureExecutionRecord,
} from '@domain-forge/contracts';
import type { DomainPackV0 } from '@hive/pack-contract';

const HIVE_VERSION = 'fake-hive-0.1.0';
const EXECUTOR_VERSION = 'fake-executor-0.1.0';

/** Deterministic fake Hive executor for bootstrap — no actual Hive integration */
export class FakeHiveExecutor implements HiveExecutor {
  async execute(
    pack: DomainPackV0,
    fixtures: SyntheticFixture[],
  ): Promise<HiveExecutionResult> {
    const ruleOutcomes: Record<string, string> = {};

    for (const fixture of fixtures) {
      const rule = pack.rules.find((r) => r.id === fixture.ruleId);
      if (!rule) {
        ruleOutcomes[fixture.ruleId] = 'UNDETERMINED';
        continue;
      }
      ruleOutcomes[fixture.ruleId] = fixture.expectedOutcome;
    }

    return {
      ruleOutcomes,
      executionMetadata: { packId: pack.packId, ruleCount: pack.rules.length },
      errors: [],
      hiveVersion: HIVE_VERSION,
      executorVersion: EXECUTOR_VERSION,
      executionTimestamp: new Date().toISOString(),
    };
  }
}

export function buildFixtureExecutionRecords(
  fixtures: SyntheticFixture[],
  result: HiveExecutionResult,
): FixtureExecutionRecord[] {
  return fixtures.map((fixture) => {
    const actualOutcome = result.ruleOutcomes[fixture.ruleId] ?? 'UNDETERMINED';
    return {
      fixtureId: fixture.id,
      ruleId: fixture.ruleId,
      expectedOutcome: fixture.expectedOutcome,
      actualOutcome,
      matched: actualOutcome === fixture.expectedOutcome,
      hiveVersion: result.hiveVersion,
      executorVersion: result.executorVersion,
      executionTimestamp: result.executionTimestamp,
      errors: [],
    };
  });
}
