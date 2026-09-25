import { z } from 'zod';

/** Declarative pack capability requirement for runtime eligibility evaluation. */
export const CapabilityRequirementEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
    capabilityId: z.string().min(1).max(128),
    minVersion: z.string().min(1).max(64),
    feature: z.string().min(1).max(128).optional(),
  })
  .strict();

export type CapabilityRequirementEntry = z.infer<typeof CapabilityRequirementEntrySchema>;
