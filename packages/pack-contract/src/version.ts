import { z } from 'zod';
import { DOMAIN_PACK_SCHEMA_VERSION } from './constants.js';

/** Semantic version string for a specific pack release. */
export const PackVersionStringSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, {
    message: 'packVersion must be a semantic version string',
  });

export const PackVersionMetadataSchema = z
  .object({
    schemaVersion: z.literal(DOMAIN_PACK_SCHEMA_VERSION),
    packVersion: PackVersionStringSchema,
  })
  .strict();

export type PackVersionString = z.infer<typeof PackVersionStringSchema>;
export type PackVersionMetadata = z.infer<typeof PackVersionMetadataSchema>;

export function parsePackVersionMetadata(input: unknown): PackVersionMetadata {
  return PackVersionMetadataSchema.parse(input);
}

export function safeParsePackVersionMetadata(input: unknown) {
  return PackVersionMetadataSchema.safeParse(input);
}
