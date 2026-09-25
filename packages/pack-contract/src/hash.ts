import { createHash } from 'node:crypto';
import type { DomainPackV0 } from './domain-pack-v0.js';

/** Deterministic canonical JSON serialization for pack hashing */
export function canonicalizePackContent(pack: DomainPackV0): string {
  return JSON.stringify(sortKeys(pack));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Compute immutable packContentHash from pack bytes */
export function computePackContentHash(pack: DomainPackV0): string {
  const canonical = canonicalizePackContent(pack);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
