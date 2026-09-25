import { z } from 'zod';
import { PackManifestSchema } from './manifest.js';
import { ReservedCompositionConfigSchema } from './reserved-sections.js';
import {
  AuthorityReferenceSchema,
  DocumentTypeSchema,
  VocabularyTermSchema,
  EntitySchema,
  FactSchema,
  RuleSchema,
  TimeModelEntrySchema,
  IdentityStrategyEntrySchema,
  QuestionSchema,
} from './section-schemas.js';
import { ExtractionContractEntrySchema } from './extraction-contract-v0.js';
import { OutputSpecificationEntrySchema } from './output-specification-v0.js';
import { FixtureReferenceSchema } from './fixture-reference-v0.js';
import { CapabilityRequirementEntrySchema } from './capability-requirement-v0.js';
import { PackSectionEntrySchema } from './reserved-sections.js';

/**
 * DomainPackV0 — immutable executable pack content shell.
 *
 * Step 5 implements foundational identity/version/metadata via the manifest fields
 * and reserves additional executable sections for later bootstrap steps.
 * Lifecycle state is never part of pack bytes.
 */
export const DomainPackV0Schema = PackManifestSchema.extend({
  /**
   * Optional hash binding to the authority corpus.
   * Populated once Stage 1 authority work exists.
   */
  corpusHash: z.string().min(1).max(128).optional(),

  authorityReferences: z.array(AuthorityReferenceSchema).default([]),
  documentTypes: z.array(DocumentTypeSchema).default([]),
  vocabulary: z.array(VocabularyTermSchema).default([]),
  entities: z.array(EntitySchema).default([]),
  facts: z.array(FactSchema).default([]),
  extractionContracts: z.array(ExtractionContractEntrySchema).default([]),
  outputSpecifications: z.array(OutputSpecificationEntrySchema).default([]),
  composition: ReservedCompositionConfigSchema.default({}),
  timeModels: z.array(TimeModelEntrySchema).default([]),
  identityStrategies: z.array(IdentityStrategyEntrySchema).default([]),
  rules: z.array(RuleSchema).default([]),
  questions: z.array(QuestionSchema).default([]),
  capabilityRequirements: z.array(CapabilityRequirementEntrySchema).default([]),
  fixtureReferences: z.array(FixtureReferenceSchema).default([]),
  provenanceReferences: z.array(PackSectionEntrySchema).default([]),
}).strict();

export type DomainPackV0 = z.infer<typeof DomainPackV0Schema>;

export function parseDomainPackV0(input: unknown): DomainPackV0 {
  return DomainPackV0Schema.parse(input);
}

export function safeParseDomainPackV0(input: unknown) {
  return DomainPackV0Schema.safeParse(input);
}
