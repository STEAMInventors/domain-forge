import type { DomainPackV0 } from '@hive/pack-contract';

export interface SyntheticFixture {
  id: string;
  ruleId: string;
  fixtureType: 'FIRE' | 'MUST_NOT_FIRE' | 'EXCEPTION' | 'UNDETERMINED';
  documents: Record<string, unknown>;
  expectedOutcome: 'FIRED' | 'NOT_FIRED' | 'UNDETERMINED';
}

export interface FixtureExecutionRecord {
  fixtureId: string;
  ruleId: string;
  expectedOutcome: string;
  actualOutcome: string;
  matched: boolean;
  hiveVersion: string;
  executorVersion: string;
  executionTimestamp: string;
  errors: readonly string[];
}

export interface HiveExecutionResult {
  ruleOutcomes: Record<string, string>;
  executionMetadata: Record<string, unknown>;
  errors: readonly string[];
  hiveVersion: string;
  executorVersion: string;
  executionTimestamp: string;
}

export interface HiveExecutor {
  execute(
    pack: DomainPackV0,
    fixtures: SyntheticFixture[],
    config?: Record<string, unknown>,
  ): Promise<HiveExecutionResult>;
}
