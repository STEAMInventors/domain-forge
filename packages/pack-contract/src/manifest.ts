import { z } from 'zod';
import { DOMAIN_PACK_SCHEMA_VERSION } from './constants.js';
import { PackIdSchema, DomainIdSchema } from './identity.js';
import { PackVersionStringSchema } from './version.js';
import { PackScopeSchema } from './scope.js';
import { PackDependenciesSchema } from './dependencies.js';

/**
 * Foundational pack manifest: identity, version, scope, and dependency declarations.
 * Lifecycle state (DRAFT/PROVISIONAL/CERTIFIED) is not part of pack content.
 */
export const PackManifestSchema = z
  .object({
    schemaVersion: z.literal(DOMAIN_PACK_SCHEMA_VERSION),
    packId: PackIdSchema,
    domainId: DomainIdSchema,
    packVersion: PackVersionStringSchema,
    scope: PackScopeSchema.shape.scope,
    jurisdiction: PackScopeSchema.shape.jurisdiction,
    dependencies: PackDependenciesSchema,
    /** Optional human-readable description; not used for hashing or execution. */
    description: z.string().max(2048).optional(),
    /** Optional labels for tooling and discovery; not used for execution. */
    labels: z.record(z.string().max(256)).optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof PackManifestSchema>;

export function parsePackManifest(input: unknown): PackManifest {
  return PackManifestSchema.parse(input);
}

export function safeParsePackManifest(input: unknown) {
  return PackManifestSchema.safeParse(input);
}
