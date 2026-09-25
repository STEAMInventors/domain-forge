import { z } from 'zod';
import { DOMAIN_PACK_SCHEMA_VERSION } from './constants.js';

/**
 * Declarative fixture corpus reference embedded in Domain Pack content.
 *
 * Pack bytes reference external fixture corpus — they do not embed full source payloads
 * or qualification execution results.
 */
export const FixtureReferenceSchema = z
  .object({
    id: z.string().min(1).max(128),
    /** External fixture corpus identifier — distinct from authority corpusHash on manifest. */
    corpusId: z.string().min(1).max(128).optional(),
    /** Deterministic hash of the referenced fixture corpus set (fixtureCorpusHash). */
    fixtureCorpusHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'fixtureCorpusHash must be a 64-char lowercase hex SHA-256 digest')
      .optional(),
    /** Subset of fixture ids from the referenced corpus — empty means entire corpus. */
    fixtureIds: z.array(z.string().min(1).max(128)).default([]),
    /** Pin compatibility to an exact immutable pack content hash. */
    packContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/, 'packContentHash must be a 64-char lowercase hex SHA-256 digest')
      .optional(),
    /** Minimum pack schema version the referenced fixtures require. */
    schemaVersion: z.literal(DOMAIN_PACK_SCHEMA_VERSION).optional(),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type FixtureReference = z.infer<typeof FixtureReferenceSchema>;

export function parseFixtureReference(input: unknown): FixtureReference {
  return FixtureReferenceSchema.parse(input);
}

export function safeParseFixtureReference(input: unknown) {
  return FixtureReferenceSchema.safeParse(input);
}
