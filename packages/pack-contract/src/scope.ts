import { z } from 'zod';

/** Declared operational scope and jurisdiction for a Domain Pack. */
export const PackScopeSchema = z
  .object({
    scope: z.string().min(1).max(512),
    jurisdiction: z.string().min(1).max(128),
  })
  .strict();

export type PackScope = z.infer<typeof PackScopeSchema>;

export function parsePackScope(input: unknown): PackScope {
  return PackScopeSchema.parse(input);
}

export function safeParsePackScope(input: unknown) {
  return PackScopeSchema.safeParse(input);
}
