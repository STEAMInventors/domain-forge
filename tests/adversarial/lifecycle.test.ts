import { describe, it, expect, beforeEach } from 'vitest';
import {
  transitionForgeRun,
  transitionPackVersion,
  canTransitionForgeRun,
  canTransitionPackVersion,
  applyForgeRunTransitionAction,
  applyPackVersionTransitionAction,
  PACK_VERSION_STATES,
  FORGE_RUN_STATES,
  LifecycleTransitionError,
  parsePackVersionState,
  parseForgeRunState,
} from '@domain-forge/core';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { createPackVersion } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import { asForgeRunId, emptyBudgetUsage } from '@domain-forge/core';

describe('adversarial: PackVersion lifecycle', () => {
  const illegalTargets: Array<[string, string]> = [
    ['DRAFT', 'CERTIFIED'],
    ['DRAFT', 'SUSPENDED'],
    ['CERTIFIED', 'DRAFT'],
    ['CERTIFIED', 'PROVISIONAL'],
    ['SUSPENDED', 'CERTIFIED'],
    ['SUPERSEDED', 'DRAFT'],
    ['SUPERSEDED', 'PROVISIONAL'],
    ['SUPERSEDED', 'CERTIFIED'],
  ];

  it.each(illegalTargets)('rejects direct transition %s → %s', (from, to) => {
    expect(canTransitionPackVersion(from as never, to as never)).toBe(false);
    expect(() => transitionPackVersion(from as never, to as never)).toThrow(LifecycleTransitionError);
  });

  it.each(PACK_VERSION_STATES)('rejects same-state transition for %s', (state) => {
    expect(canTransitionPackVersion(state, state)).toBe(false);
    expect(() => transitionPackVersion(state, state)).toThrow(LifecycleTransitionError);
  });

  it('rejects arbitrary state injection via parsePackVersionState', () => {
    expect(() => parsePackVersionState('PUBLISHED')).toThrow(LifecycleTransitionError);
    expect(() => parsePackVersionState('CERTIFIED_BYPASS')).toThrow(LifecycleTransitionError);
    expect(() => parsePackVersionState(null)).toThrow(LifecycleTransitionError);
  });

  it('rejects DRAFT → CERTIFIED via disallowed action', () => {
    expect(() => applyPackVersionTransitionAction('DRAFT', 'CERTIFY')).toThrow(LifecycleTransitionError);
  });
});

describe('adversarial: ForgeRun lifecycle', () => {
  const illegalTargets: Array<[string, string]> = [
    ['CREATED', 'COMPLETED'],
    ['CREATED', 'FAILED'],
    ['WAITING_FOR_HUMAN', 'COMPLETED'],
    ['BLOCKED', 'COMPLETED'],
    ['COMPLETED', 'RUNNING'],
    ['FAILED', 'RUNNING'],
    ['COMPLETED', 'FAILED'],
  ];

  it.each(illegalTargets)('rejects direct transition %s → %s', (from, to) => {
    expect(canTransitionForgeRun(from as never, to as never)).toBe(false);
    expect(() => transitionForgeRun(from as never, to as never)).toThrow(LifecycleTransitionError);
  });

  it.each(FORGE_RUN_STATES)('rejects same-state transition for %s', (state) => {
    expect(canTransitionForgeRun(state, state)).toBe(false);
    expect(() => transitionForgeRun(state, state)).toThrow(LifecycleTransitionError);
  });

  it('rejects unknown ForgeRun state injection', () => {
    expect(() => parseForgeRunState('CERTIFIED')).toThrow(LifecycleTransitionError);
  });

  it('rejects CREATED → COMPLETED via disallowed COMPLETE action', () => {
    expect(() => applyForgeRunTransitionAction('CREATED', 'COMPLETE')).toThrow(LifecycleTransitionError);
  });

  it('rejects BLOCKED → COMPLETED without RESUME', () => {
    expect(() => applyForgeRunTransitionAction('BLOCKED', 'COMPLETE')).toThrow(LifecycleTransitionError);
  });

  it('rejects WAITING_FOR_HUMAN → COMPLETED without RESUME', () => {
    expect(() => applyForgeRunTransitionAction('WAITING_FOR_HUMAN', 'COMPLETE')).toThrow(LifecycleTransitionError);
  });
});

describe('adversarial: lifecycle persistence bypass resistance', () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it('rejects direct PackVersion state mutation via save', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);
    await expect(
      repos.packVersions.save({ ...packVersion, state: 'CERTIFIED' }),
    ).rejects.toMatchObject({ persistenceCode: 'IMMUTABLE_RECORD_MODIFICATION' });
  });

  it('rejects illegal DRAFT → CERTIFY lifecycle transition via persistence', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);
    await expect(
      repos.packVersionLifecycle.applyTransition({
        packVersionId: packVersion.id,
        action: 'CERTIFY',
        expectedFromState: 'DRAFT',
      }),
    ).rejects.toThrow();
  });

  it('rejects direct ForgeRun state mutation bypassing state machine', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    const run = {
      id: asForgeRunId('run-adversarial-001'),
      packId: packVersion.packId,
      packVersionId: packVersion.id,
      domainId: 'domain-neutral-test',
      state: 'CREATED' as const,
      budget: {
        maxModelInvocations: 10,
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        maxTotalTokens: 2000,
        maxRetryAttempts: 1,
        maxRuleReviewRounds: 1,
      },
      budgetUsage: emptyBudgetUsage(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repos.forgeRuns.insert(run);
    await expect(
      repos.forgeRuns.save({ ...run, state: 'COMPLETED' }),
    ).rejects.toMatchObject({ persistenceCode: 'IMMUTABLE_RECORD_MODIFICATION' });
  });

  it('rejects CREATED → COMPLETED transition via persistence lifecycle', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    const run = {
      id: asForgeRunId('run-adversarial-002'),
      packId: packVersion.packId,
      packVersionId: packVersion.id,
      domainId: 'domain-neutral-test',
      state: 'CREATED' as const,
      budget: {
        maxModelInvocations: 10,
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        maxTotalTokens: 2000,
        maxRetryAttempts: 1,
        maxRuleReviewRounds: 1,
      },
      budgetUsage: emptyBudgetUsage(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repos.forgeRuns.insert(run);
    await expect(
      repos.forgeRunLifecycle.applyTransition({
        forgeRunId: run.id,
        action: 'COMPLETE',
        expectedFromState: 'CREATED',
      }),
    ).rejects.toThrow();
  });
});
