import { z } from 'zod';

/** Stable pack identifier within a domain. */
export const PackIdSchema = z.string().min(1).max(128);

/** Domain identifier grouping related packs. */
export const DomainIdSchema = z.string().min(1).max(128);

export const PackIdentitySchema = z
  .object({
    packId: PackIdSchema,
    domainId: DomainIdSchema,
  })
  .strict();

export type PackId = z.infer<typeof PackIdSchema>;
export type DomainId = z.infer<typeof DomainIdSchema>;
export type PackIdentity = z.infer<typeof PackIdentitySchema>;

export function parsePackIdentity(input: unknown): PackIdentity {
  return PackIdentitySchema.parse(input);
}

export function safeParsePackIdentity(input: unknown) {
  return PackIdentitySchema.safeParse(input);
}
