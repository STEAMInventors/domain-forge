import { describe, it, expect } from 'vitest';
import { FakeHiveExecutor, buildFixtureExecutionRecords } from './fake-hive-executor.js';
import { createMinimalTestPack } from '@domain-forge/testing';

describe('FakeHiveExecutor', () => {
  it('executes fixtures and records outcomes', async () => {
    const pack = createMinimalTestPack();
    const fixtures = [
      {
        id: 'fix-001',
        ruleId: 'rule-001',
        fixtureType: 'FIRE' as const,
        documents: { recordStatus: 'active' },
        expectedOutcome: 'FIRED' as const,
      },
    ];

    const executor = new FakeHiveExecutor();
    const result = await executor.execute(pack, fixtures);
    const records = buildFixtureExecutionRecords(fixtures, result);

    expect(records[0]!.matched).toBe(true);
    expect(records[0]!.hiveVersion).toBeDefined();
  });
});
