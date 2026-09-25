import type { DomainPackV0 } from './domain-pack-v0.js';

/**
 * Manifest fields excluded from packContentHash.
 * These are tooling/discovery metadata, not executable pack content.
 */
export const HASH_EXCLUDED_MANIFEST_FIELDS = ['description', 'labels'] as const;

export type HashExcludedManifestField = (typeof HASH_EXCLUDED_MANIFEST_FIELDS)[number];

/** Executable pack content participating in packContentHash. */
export type HashablePackContent = Omit<
  DomainPackV0,
  HashExcludedManifestField
>;

/** Extract the hashable executable payload from validated pack content. */
export function extractHashablePackContent(pack: DomainPackV0): HashablePackContent {
  const hashable = { ...pack };
  for (const field of HASH_EXCLUDED_MANIFEST_FIELDS) {
    delete hashable[field];
  }
  return hashable as HashablePackContent;
}
