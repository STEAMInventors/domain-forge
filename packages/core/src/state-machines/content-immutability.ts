import { lifecycleContentMutation } from './lifecycle-errors.js';

export interface PackContentSnapshot {
  packContent: unknown;
  packContentHash: string;
}

/** Lifecycle transitions must not alter immutable pack bytes or their hash. */
export function assertPackContentImmutable(
  before: PackContentSnapshot,
  after: PackContentSnapshot,
): void {
  if (before.packContentHash !== after.packContentHash) {
    throw lifecycleContentMutation('PackVersion', {
      field: 'packContentHash',
      before: before.packContentHash,
      after: after.packContentHash,
    });
  }

  if (!deepEqual(before.packContent, after.packContent)) {
    throw lifecycleContentMutation('PackVersion', {
      field: 'packContent',
      before: before.packContentHash,
      after: after.packContentHash,
    });
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
