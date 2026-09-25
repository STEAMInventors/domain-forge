import { createHash } from 'node:crypto';
import { canonicalizeJson, CanonicalizationError } from './canonical/jcs-v1.js';
import { parseDomainPackV0, type DomainPackV0 } from './domain-pack-v0.js';
import { extractHashablePackContent } from './hashable-content.js';

export class PackContentHashError extends Error {
  readonly code = 'PACK_CONTENT_HASH_ERROR' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PackContentHashError';
  }
}

/** Compute the deterministic SHA-256 hash of canonical executable pack content. */
export function computePackContentHash(input: DomainPackV0 | unknown): string {
  let pack: DomainPackV0;
  try {
    pack = parseDomainPackV0(input);
  } catch (error) {
    throw new PackContentHashError('Pack content failed schema validation before hashing', { cause: error });
  }

  const hashable = extractHashablePackContent(pack);

  let canonical: string;
  try {
    canonical = canonicalizeJson(hashable);
  } catch (error) {
    if (error instanceof CanonicalizationError) {
      throw new PackContentHashError(`Pack content is not canonicalizable: ${error.message}`, { cause: error });
    }
    throw error;
  }

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
