import { computePackContentHash, type DomainPackV0 } from '@hive/pack-contract';
import {
  transitionPackVersion,
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
    corpusHash: packContent.corpusHash,
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

  if (packVersion.state !== 'DRAFT') {
    return {
      canTransition: false,
      newState: packVersion.state,
      errors: ['Pack version is not in DRAFT state'],
    };
  }

  transitionPackVersion('DRAFT', 'PROVISIONAL');
  return { canTransition: true, newState: 'PROVISIONAL', errors: [] };
}

export function applyPackVersionTransition(
  packVersion: PackVersion,
  to: PackVersionState,
): PackVersion {
  const newState = transitionPackVersion(packVersion.state, to);
  return {
    ...packVersion,
    state: newState,
    updatedAt: new Date().toISOString(),
  };
}
