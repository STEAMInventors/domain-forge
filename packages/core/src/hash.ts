import { createHash } from 'node:crypto';

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashObject(value: unknown): string {
  const canonical = JSON.stringify(sortKeys(value));
  return sha256Hex(canonical);
}

function sortKeys(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(sortKeys);
  if (val !== null && typeof val === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((val as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return val;
}
