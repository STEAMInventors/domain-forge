import { z } from 'zod';

/** Hive-shared pack schema version identifier */
export const DOMAIN_PACK_SCHEMA_VERSION = '0.1.0' as const;

export const AuthorityReferenceSchema = z.object({
  id: z.string().min(1),
  sourceSnapshotId: z.string().min(1),
  quote: z.string().min(1),
  normalizedQuote: z.string().optional(),
  location: z.string().optional(),
});
export type AuthorityReference = z.infer<typeof AuthorityReferenceSchema>;

export const DocumentTypeDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  requiredFields: z.array(z.string()).default([]),
});
export type DocumentTypeDefinition = z.infer<typeof DocumentTypeDefinitionSchema>;

export const VocabularyTermSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
  authorityRefIds: z.array(z.string()).default([]),
});
export type VocabularyTerm = z.infer<typeof VocabularyTermSchema>;

export const EntityDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  grammarType: z.string().min(1),
  attributes: z.record(z.string()).default({}),
});
export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;

export const FactDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  entityId: z.string().min(1),
  dataType: z.string().min(1),
  authorityRefIds: z.array(z.string()).default([]),
});
export type FactDefinition = z.infer<typeof FactDefinitionSchema>;

export const DeclarativeRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  trigger: z.string().min(1),
  primitive: z.string().min(1),
  entityIds: z.array(z.string()).default([]),
  factIds: z.array(z.string()).default([]),
  exceptions: z.array(z.string()).default([]),
  authorityRefIds: z.array(z.string()).min(1),
  weight: z.number().optional(),
  priority: z.number().optional(),
});
export type DeclarativeRule = z.infer<typeof DeclarativeRuleSchema>;

export const QuestionDefinitionSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  text: z.string().min(1),
  requiredFacts: z.array(z.string()).default([]),
});
export type QuestionDefinition = z.infer<typeof QuestionDefinitionSchema>;

export const CompositionConfigSchema = z.object({
  strategy: z.string().min(1),
  archetype: z.string().min(1),
});
export type CompositionConfig = z.infer<typeof CompositionConfigSchema>;

export const TimeModelConfigSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
});
export type TimeModelConfig = z.infer<typeof TimeModelConfigSchema>;

export const IdentityStrategyConfigSchema = z.object({
  entityId: z.string().min(1),
  strategy: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
});
export type IdentityStrategyConfig = z.infer<typeof IdentityStrategyConfigSchema>;

export const CapabilityRequirementSchema = z.object({
  id: z.string().min(1),
  capability: z.string().min(1),
  required: z.boolean().default(true),
});
export type CapabilityRequirement = z.infer<typeof CapabilityRequirementSchema>;

export const FixtureReferenceSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  fixtureType: z.enum(['FIRE', 'MUST_NOT_FIRE', 'EXCEPTION', 'UNDETERMINED']),
  description: z.string().optional(),
});
export type FixtureReference = z.infer<typeof FixtureReferenceSchema>;

export const ProvenanceReferenceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  ref: z.string().min(1),
  hash: z.string().optional(),
});
export type ProvenanceReference = z.infer<typeof ProvenanceReferenceSchema>;

/**
 * DomainPackV0 — immutable executable pack content.
 * Lifecycle state (DRAFT/PROVISIONAL/CERTIFIED) is NOT part of this contract.
 */
export const DomainPackV0Schema = z.object({
  schemaVersion: z.literal(DOMAIN_PACK_SCHEMA_VERSION),
  packId: z.string().min(1),
  domainId: z.string().min(1),
  packVersion: z.string().min(1),
  scope: z.string().min(1),
  jurisdiction: z.string().min(1),
  corpusHash: z.string().min(1),
  authorityReferences: z.array(AuthorityReferenceSchema).default([]),
  documentTypes: z.array(DocumentTypeDefinitionSchema).default([]),
  vocabulary: z.array(VocabularyTermSchema).default([]),
  entities: z.array(EntityDefinitionSchema).default([]),
  facts: z.array(FactDefinitionSchema).default([]),
  composition: CompositionConfigSchema,
  timeModels: z.array(TimeModelConfigSchema).default([]),
  identityStrategies: z.array(IdentityStrategyConfigSchema).default([]),
  rules: z.array(DeclarativeRuleSchema).default([]),
  questions: z.array(QuestionDefinitionSchema).default([]),
  capabilityRequirements: z.array(CapabilityRequirementSchema).default([]),
  fixtureReferences: z.array(FixtureReferenceSchema).default([]),
  provenanceReferences: z.array(ProvenanceReferenceSchema).default([]),
});

export type DomainPackV0 = z.infer<typeof DomainPackV0Schema>;

export function parseDomainPackV0(input: unknown): DomainPackV0 {
  return DomainPackV0Schema.parse(input);
}

export function safeParseDomainPackV0(input: unknown) {
  return DomainPackV0Schema.safeParse(input);
}
