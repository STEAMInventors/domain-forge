import { z } from 'zod';
import { PackIdSchema } from './identity.js';
import { PackVersionStringSchema } from './version.js';
import { PackDependencyRefSchema } from './dependencies.js';

export const PACK_COMPOSITION_MANIFEST_SCHEMA_VERSION = '0.1.0' as const;

export const PackCompositionLayerRoleSchema = z.enum(['shared', 'extends', 'root', 'overlay']);

export const PackCompositionLayerSchema = z
  .object({
    role: PackCompositionLayerRoleSchema,
    packId: PackIdSchema,
    packVersion: PackVersionStringSchema,
    packContentHash: PackDependencyRefSchema.shape.packContentHash,
    /** Stable merge-order index within the composition manifest. */
    order: z.number().int().nonnegative(),
  })
  .strict();

export const PackCompositionManifestSchema = z
  .object({
    schemaVersion: z.literal(PACK_COMPOSITION_MANIFEST_SCHEMA_VERSION),
    root: PackDependencyRefSchema,
    layers: z.array(PackCompositionLayerSchema),
  })
  .strict();

export type PackCompositionLayerRole = z.infer<typeof PackCompositionLayerRoleSchema>;
export type PackCompositionLayer = z.infer<typeof PackCompositionLayerSchema>;
export type PackCompositionManifest = z.infer<typeof PackCompositionManifestSchema>;

export function parsePackCompositionManifest(input: unknown): PackCompositionManifest {
  return PackCompositionManifestSchema.parse(input);
}
