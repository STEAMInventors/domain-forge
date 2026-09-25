import { z } from 'zod';

/**
 * Minimal entry boundary for pack list sections.
 * Detailed schemas are introduced in later bootstrap steps.
 */
export const PackSectionEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
  })
  .strict();

export type PackSectionEntry = z.infer<typeof PackSectionEntrySchema>;

/** Reserved composition configuration boundary (expanded in Step 6+). */
export const ReservedCompositionConfigSchema = z
  .object({
    strategy: z.string().min(1).max(64).optional(),
    archetype: z.string().min(1).max(64).optional(),
  })
  .strict();

export type ReservedCompositionConfig = z.infer<typeof ReservedCompositionConfigSchema>;

export const RESERVED_PACK_SECTIONS = [
  'authorityReferences',
  'documentTypes',
  'vocabulary',
  'entities',
  'facts',
  'extractionContracts',
  'outputSpecifications',
  'composition',
  'timeModels',
  'identityStrategies',
  'rules',
  'questions',
  'capabilityRequirements',
  'fixtureReferences',
  'provenanceReferences',
] as const;

export type ReservedPackSectionName = (typeof RESERVED_PACK_SECTIONS)[number];
