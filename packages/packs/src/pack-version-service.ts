import { computePackContentHash, type DomainPackV0 } from '@hive/pack-contract';
import {
  applyPackVersionTransitionAction,
  assertPackContentImmutable,
  canApplyPackVersionTransition,
  createPackVersionTransitionRecord,
  type PackVersionTransitionAction,
  type PackVersionTransitionContext,
  type PackVersionTransitionRecord,
  type PackVersionState,
  type PackId,
  asPackVersionId,
} from '@domain-forge/core';
import type { PackVersion } from '@domain-forge/contracts';
import { ProvisionalReadinessValidator, type ProvisionalReadinessInput } from '@domain-forge/validation';

export function createPackVersion(
  packId: string,
  version: string,
  packContent: DomainPackV0,
): PackVersion {
  const packContentHash = computePackContentHash(packContent);
  const now = new Date().toISOString();
  return {
    id: asPackVersionId(`${packId}-${version}`),
    packId: packId as PackId,
    version,
    state: 'DRAFT',
    packContent,
    packContentHash,
    ...(packContent.corpusHash !== undefined
      ? { authorityCorpusHash: packContent.corpusHash }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export function freezePackContent(packVersion: PackVersion): PackVersion {
  return {
    ...packVersion,
    frozenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateProvisionalTransition(
  packVersion: PackVersion,
  readiness: ProvisionalReadinessInput,
): { canTransition: boolean; newState: PackVersionState; errors: string[] } {
  const validator = new ProvisionalReadinessValidator();
  const result = validator.validate(readiness);

  if (!result.passed) {
    return {
      canTransition: false,
      newState: packVersion.state,
      errors: result.errors.map((e) => e.message),
    };
  }

  if (!canApplyPackVersionTransition(packVersion.state, 'PROMOTE_TO_PROVISIONAL')) {
    return {
      canTransition: false,
      newState: packVersion.state,
      errors: [`Pack version is not eligible for PROMOTE_TO_PROVISIONAL from ${packVersion.state}`],
    };
  }

  return { canTransition: true, newState: 'PROVISIONAL', errors: [] };
}

export function applyPackVersionTransition(
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

/** Content changes require a new pack version — never a lifecycle transition. */
export function createPackVersionFromContentChange(
  prior: PackVersion,
  packContent: DomainPackV0,
): PackVersion {
  const packContentHash = computePackContentHash(packContent);
  if (packContentHash === prior.packContentHash) {
    return prior;
  }

  const now = new Date().toISOString();
  return {
    id: prior.id,
    packId: prior.packId,
    version: prior.version,
    state: 'DRAFT',
    packContent,
    packContentHash,
    ...(packContent.corpusHash !== undefined
      ? { authorityCorpusHash: packContent.corpusHash }
      : {}),
    createdAt: prior.createdAt,
    updatedAt: now,
  };
}
