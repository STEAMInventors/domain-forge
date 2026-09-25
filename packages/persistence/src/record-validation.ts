import { computePackContentHash, type DomainPackV0 } from '@hive/pack-contract';
import type {
  CertificationRecord,
  ForgeRun,
  PackVersion,
  QualificationRecord,
  SourceSnapshot,
} from '@domain-forge/contracts';
import type { SourceRecord } from '@domain-forge/contracts';
import type {
  ForgeRunTransitionRecord,
  PackVersionTransitionRecord,
} from '@domain-forge/core';
import { malformedPersistedRecord } from './persistence-errors.js';

function assertString(value: unknown, field: string, entity: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw malformedPersistedRecord(entity, `${field} must be a non-empty string`, { field });
  }
}

export function validatePackVersion(record: PackVersion): PackVersion {
  assertString(record.id, 'id', 'PackVersion');
  assertString(record.packId, 'packId', 'PackVersion');
  assertString(record.version, 'version', 'PackVersion');
  assertString(record.packContentHash, 'packContentHash', 'PackVersion');
  assertString(record.createdAt, 'createdAt', 'PackVersion');
  assertString(record.updatedAt, 'updatedAt', 'PackVersion');

  const computed = computePackContentHash(record.packContent as DomainPackV0);
  if (computed !== record.packContentHash) {
    throw malformedPersistedRecord('PackVersion', 'packContentHash does not match packContent', {
      id: record.id,
      expected: record.packContentHash,
      actual: computed,
    });
  }

  return record;
}

export function validateQualificationRecord(record: QualificationRecord): QualificationRecord {
  assertString(record.id, 'id', 'QualificationRecord');
  assertString(record.recordFingerprint, 'recordFingerprint', 'QualificationRecord');
  assertString(record.identity.packContentHash, 'identity.packContentHash', 'QualificationRecord');
  assertString(record.executedAt, 'executedAt', 'QualificationRecord');
  return record;
}

export function validateCertificationRecord(record: CertificationRecord): CertificationRecord {
  assertString(record.id, 'id', 'CertificationRecord');
  assertString(record.packContentHash, 'packContentHash', 'CertificationRecord');
  assertString(record.recordFingerprint, 'recordFingerprint', 'CertificationRecord');
  assertString(record.qualificationRecordFingerprint, 'qualificationRecordFingerprint', 'CertificationRecord');
  assertString(record.certifiedAt, 'certifiedAt', 'CertificationRecord');
  return record;
}

export function validateForgeRun(record: ForgeRun): ForgeRun {
  assertString(record.id, 'id', 'ForgeRun');
  assertString(record.packId, 'packId', 'ForgeRun');
  assertString(record.packVersionId, 'packVersionId', 'ForgeRun');
  assertString(record.createdAt, 'createdAt', 'ForgeRun');
  assertString(record.updatedAt, 'updatedAt', 'ForgeRun');
  return record;
}

export function validateSourceSnapshot(record: SourceSnapshot): SourceSnapshot {
  assertString(record.sourceSnapshotId, 'sourceSnapshotId', 'SourceSnapshot');
  assertString(record.sourceId, 'sourceId', 'SourceSnapshot');
  assertString(record.contentHash, 'contentHash', 'SourceSnapshot');
  assertString(record.retrievalTimestamp, 'retrievalTimestamp', 'SourceSnapshot');
  return record;
}

export function validateSourceRecord(record: SourceRecord): SourceRecord {
  assertString(record.identity.sourceId, 'identity.sourceId', 'SourceRecord');
  assertString(record.identity.contentFingerprint.hash, 'identity.contentFingerprint.hash', 'SourceRecord');
  return record;
}

export function validatePackVersionTransitionRecord(
  record: PackVersionTransitionRecord,
): PackVersionTransitionRecord {
  assertString(record.packVersionId, 'packVersionId', 'PackVersionTransitionRecord');
  assertString(record.packContentHash, 'packContentHash', 'PackVersionTransitionRecord');
  return record;
}

export function validateForgeRunTransitionRecord(
  record: ForgeRunTransitionRecord,
): ForgeRunTransitionRecord {
  assertString(record.forgeRunId, 'forgeRunId', 'ForgeRunTransitionRecord');
  return record;
}

/** Round-trip serialization validation — never trust deserialized DB objects directly. */
export function validateDeserialized<T>(
  entity: string,
  value: unknown,
  validator: (record: T) => T,
): T {
  if (value === null || typeof value !== 'object') {
    throw malformedPersistedRecord(entity, 'record must be an object');
  }
  return validator(value as T);
}
