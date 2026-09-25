import { ForgeError } from '@domain-forge/core';

export type PersistenceErrorCode =
  | 'RECORD_NOT_FOUND'
  | 'DUPLICATE_IMMUTABLE_RECORD'
  | 'OPTIMISTIC_CONCURRENCY_CONFLICT'
  | 'IMMUTABLE_RECORD_MODIFICATION'
  | 'CONTENT_HASH_MISMATCH'
  | 'TRANSACTION_CONFLICT'
  | 'CERTIFICATION_ATOMICITY_FAILURE'
  | 'INVALID_PERSISTED_LIFECYCLE_TRANSITION'
  | 'REPOSITORY_UNAVAILABLE'
  | 'MALFORMED_PERSISTED_RECORD';

export interface PersistenceErrorDetails {
  [key: string]: unknown;
}

export class PersistenceError extends ForgeError {
  readonly persistenceCode: PersistenceErrorCode;

  constructor(
    persistenceCode: PersistenceErrorCode,
    message: string,
    details?: PersistenceErrorDetails,
  ) {
    super({ code: 'PERSISTENCE_ERROR', message, details: { persistenceCode, ...details } });
    this.name = 'PersistenceError';
    this.persistenceCode = persistenceCode;
  }
}

export function recordNotFound(
  entity: string,
  id: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError('RECORD_NOT_FOUND', `${entity} not found: ${id}`, {
    entity,
    id,
    ...details,
  });
}

export function duplicateImmutableRecord(
  entity: string,
  id: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError(
    'DUPLICATE_IMMUTABLE_RECORD',
    `Duplicate immutable ${entity}: ${id}`,
    { entity, id, ...details },
  );
}

export function optimisticConcurrencyConflict(
  entity: string,
  expected: unknown,
  actual: unknown,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError(
    'OPTIMISTIC_CONCURRENCY_CONFLICT',
    `Optimistic concurrency conflict for ${entity}`,
    { entity, expected, actual, ...details },
  );
}

export function immutableRecordModification(
  entity: string,
  id: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError(
    'IMMUTABLE_RECORD_MODIFICATION',
    `Attempted modification of immutable ${entity}: ${id}`,
    { entity, id, ...details },
  );
}

export function contentHashMismatch(
  entity: string,
  expected: string,
  actual: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError(
    'CONTENT_HASH_MISMATCH',
    `Content hash mismatch for ${entity}`,
    { entity, expected, actual, ...details },
  );
}

export function transactionConflict(message: string, details?: PersistenceErrorDetails): PersistenceError {
  return new PersistenceError('TRANSACTION_CONFLICT', message, details);
}

export function certificationAtomicityFailure(
  message: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError('CERTIFICATION_ATOMICITY_FAILURE', message, details);
}

export function invalidPersistedLifecycleTransition(
  message: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError('INVALID_PERSISTED_LIFECYCLE_TRANSITION', message, details);
}

export function malformedPersistedRecord(
  entity: string,
  message: string,
  details?: PersistenceErrorDetails,
): PersistenceError {
  return new PersistenceError('MALFORMED_PERSISTED_RECORD', `Malformed ${entity}: ${message}`, {
    entity,
    ...details,
  });
}
