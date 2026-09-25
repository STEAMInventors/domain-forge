import { z } from 'zod';
import { PackIdSchema } from './identity.js';
import { PackVersionStringSchema } from './version.js';

/** Exact dependency reference — never resolved by "latest". */
export const PackDependencyRefSchema = z
  .object({
    packId: PackIdSchema,
    packVersion: PackVersionStringSchema,
    packContentHash: z
      .string()
      .min(64)
      .max(64)
      .regex(/^[a-f0-9]{64}$/, { message: 'packContentHash must be a 64-character lowercase hex SHA-256 digest' }),
  })
  .strict();

export const PackDependenciesSchema = z
  .object({
    extends: z.array(PackDependencyRefSchema).default([]),
    overlay: z.array(PackDependencyRefSchema).default([]),
    shared: z.array(PackDependencyRefSchema).default([]),
  })
  .strict()
  .default({ extends: [], overlay: [], shared: [] });

export type PackDependencyRef = z.infer<typeof PackDependencyRefSchema>;
export type PackDependencies = z.infer<typeof PackDependenciesSchema>;

export function parsePackDependencies(input: unknown): PackDependencies {
  return PackDependenciesSchema.parse(input);
}

export function safeParsePackDependencies(input: unknown) {
  return PackDependenciesSchema.safeParse(input);
}
