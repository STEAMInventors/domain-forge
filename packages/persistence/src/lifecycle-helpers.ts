import {
  applyForgeRunTransitionAction,
  applyPackVersionTransitionAction,
  assertPackContentImmutable,
  createForgeRunTransitionRecord,
  createPackVersionTransitionRecord,
  type ForgeRunTransitionAction,
  type ForgeRunTransitionContext,
  type ForgeRunTransitionRecord,
  type ForgeRunState,
  type PackVersionTransitionAction,
  type PackVersionTransitionContext,
  type PackVersionTransitionRecord,
  type PackVersionState,
} from '@domain-forge/core';
import type { ForgeRun, PackVersion } from '@domain-forge/contracts';
import { invalidPersistedLifecycleTransition } from './persistence-errors.js';

export function computeForgeRunTransition(
  run: ForgeRun,
  action: ForgeRunTransitionAction,
  context?: ForgeRunTransitionContext,
): { run: ForgeRun; record: ForgeRunTransitionRecord } {
  const fromState = run.state;
  const toState = applyForgeRunTransitionAction(fromState, action);
  const now = new Date().toISOString();
  const updated: ForgeRun = {
    ...run,
    state: toState,
    updatedAt: now,
    ...(toState === 'COMPLETED' || toState === 'FAILED' ? { completedAt: now } : {}),
  };

  const record = createForgeRunTransitionRecord(
    {
      forgeRunId: run.id,
      packVersionId: run.packVersionId,
      packId: run.packId,
    },
    { fromState, toState, action },
    context,
  );

  return { run: updated, record };
}

export function computePackVersionTransition(
  packVersion: PackVersion,
  action: PackVersionTransitionAction,
  context?: PackVersionTransitionContext,
): { packVersion: PackVersion; record: PackVersionTransitionRecord } {
  const fromState = packVersion.state;
  const toState = applyPackVersionTransitionAction(fromState, action);
  const updated: PackVersion = {
    ...packVersion,
    state: toState,
    updatedAt: new Date().toISOString(),
  };

  assertPackContentImmutable(packVersion, updated);

  const record = createPackVersionTransitionRecord(
    {
      packVersionId: packVersion.id,
      packId: packVersion.packId,
      version: packVersion.version,
      packContentHash: packVersion.packContentHash,
    },
    { fromState, toState, action },
    context,
  );

  return { packVersion: updated, record };
}

export function assertCertificationTransitionRecord(
  record: PackVersionTransitionRecord,
  expectedFromState: PackVersionState,
): void {
  if (record.fromState !== expectedFromState || record.toState !== 'CERTIFIED' || record.action !== 'CERTIFY') {
    throw invalidPersistedLifecycleTransition(
      'Certification persistence requires PROVISIONAL → CERTIFIED via CERTIFY action',
      {
        fromState: record.fromState,
        toState: record.toState,
        action: record.action,
        expectedFromState,
      },
    );
  }
}

export function assertForgeRunExpectedState(
  actual: ForgeRunState,
  expected: ForgeRunState,
  forgeRunId: string,
): void {
  if (actual !== expected) {
    throw invalidPersistedLifecycleTransition(
      `ForgeRun ${forgeRunId} expected state ${expected} but found ${actual}`,
      { forgeRunId, expected, actual },
    );
  }
}

export function assertPackVersionExpectedState(
  actual: PackVersionState,
  expected: PackVersionState,
  packVersionId: string,
): void {
  if (actual !== expected) {
    throw invalidPersistedLifecycleTransition(
      `PackVersion ${packVersionId} expected state ${expected} but found ${actual}`,
      { packVersionId, expected, actual },
    );
  }
}
