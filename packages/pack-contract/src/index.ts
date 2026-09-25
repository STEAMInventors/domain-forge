export { DOMAIN_PACK_SCHEMA_VERSION } from './constants.js';
export type { DomainPackSchemaVersion } from './constants.js';

export {
  PackIdSchema,
  DomainIdSchema,
  PackIdentitySchema,
  parsePackIdentity,
  safeParsePackIdentity,
} from './identity.js';
export type { PackId, DomainId, PackIdentity } from './identity.js';

export {
  PackVersionStringSchema,
  PackVersionMetadataSchema,
  parsePackVersionMetadata,
  safeParsePackVersionMetadata,
} from './version.js';
export type { PackVersionString, PackVersionMetadata } from './version.js';

export { PackScopeSchema, parsePackScope, safeParsePackScope } from './scope.js';
export type { PackScope } from './scope.js';

export {
  PackDependencyRefSchema,
  PackDependenciesSchema,
  parsePackDependencies,
  safeParsePackDependencies,
} from './dependencies.js';
export type { PackDependencyRef, PackDependencies } from './dependencies.js';

export { PackManifestSchema, parsePackManifest, safeParsePackManifest } from './manifest.js';
export type { PackManifest } from './manifest.js';

export {
  PackSectionEntrySchema,
  ReservedCompositionConfigSchema,
  RESERVED_PACK_SECTIONS,
} from './reserved-sections.js';
export type {
  PackSectionEntry,
  ReservedCompositionConfig,
  ReservedPackSectionName,
} from './reserved-sections.js';

export {
  OutputRuleOutcomeIdSchema,
  OutputMissingnessStateSchema,
  OutputAudienceSchema,
  OutputEmptyStateBehaviorSchema,
  OutputSupportRequirementSchema,
  OutputClaimTypeDefinitionSchema,
  OutputVisibilityConditionSchema,
  OutputSectionCardinalitySchema,
  OutputFieldSourceSchema,
  OutputSectionFieldSchema,
  OutputNarrativePermissionsSchema,
  OutputSectionDefinitionSchema,
  CustomerOutputConstraintsSchema,
  OutputSpecificationEntrySchema,
  parseOutputSpecificationEntry,
  safeParseOutputSpecificationEntry,
} from './output-specification-v0.js';
export type {
  OutputRuleOutcomeId,
  OutputMissingnessState,
  OutputAudience,
  OutputEmptyStateBehavior,
  OutputSupportRequirement,
  OutputClaimTypeDefinition,
  OutputVisibilityCondition,
  OutputSectionCardinality,
  OutputFieldSource,
  OutputSectionField,
  OutputNarrativePermissions,
  OutputSectionDefinition,
  CustomerOutputConstraints,
  OutputSpecificationEntry,
} from './output-specification-v0.js';

export {
  ExtractionValueTypeSchema,
  ExtractionCardinalitySchema,
  ExtractionMissingnessStateSchema,
  ExtractionEvidenceRequirementSchema,
  DocumentRecognitionSchema,
  ExtractionEscapeHatchesSchema,
  ExtractionIdentityHintSchema,
  ExtractionPhrasingConstraintSchema,
  ExtractionReferenceRegistrySchema,
  ExtractionContractEntrySchema,
  parseExtractionContractEntry,
  safeParseExtractionContractEntry,
} from './extraction-contract-v0.js';
export type {
  ExtractionValueType,
  ExtractionCardinality,
  ExtractionMissingnessState,
  ExtractionEvidenceRequirement,
  DocumentRecognition,
  ExtractionEscapeHatches,
  ExtractionIdentityHint,
  ExtractionPhrasingConstraint,
  ExtractionReferenceRegistry,
  ExtractionContractEntry,
} from './extraction-contract-v0.js';

export {
  FixtureReferenceSchema,
  parseFixtureReference,
  safeParseFixtureReference,
} from './fixture-reference-v0.js';
export type { FixtureReference } from './fixture-reference-v0.js';

export {
  CapabilityRequirementEntrySchema,
} from './capability-requirement-v0.js';
export type { CapabilityRequirementEntry } from './capability-requirement-v0.js';

export {
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
export type {
  AuthorityReference,
  DocumentType,
  VocabularyTerm,
  Entity,
  Fact,
  Rule,
  TimeModelEntry,
  IdentityStrategyEntry,
  Question,
} from './section-schemas.js';

export {
  DomainPackV0Schema,
  parseDomainPackV0,
  safeParseDomainPackV0,
} from './domain-pack-v0.js';
export type { DomainPackV0 } from './domain-pack-v0.js';

export { CANONICALIZATION_VERSION, canonicalizeJson, CanonicalizationError } from './canonical/jcs-v1.js';

export {
  HASH_EXCLUDED_MANIFEST_FIELDS,
  extractHashablePackContent,
} from './hashable-content.js';
export type { HashablePackContent, HashExcludedManifestField } from './hashable-content.js';

export { computePackContentHash, PackContentHashError } from './pack-content-hash.js';

export { PackCompositionError } from './composition-errors.js';
export type { PackCompositionErrorCode } from './composition-errors.js';

export {
  PACK_COMPOSITION_MANIFEST_SCHEMA_VERSION,
  PackCompositionLayerRoleSchema,
  PackCompositionLayerSchema,
  PackCompositionManifestSchema,
  parsePackCompositionManifest,
} from './composition-manifest.js';
export type {
  PackCompositionLayerRole,
  PackCompositionLayer,
  PackCompositionManifest,
} from './composition-manifest.js';

export {
  LIST_PACK_SECTIONS,
  dependencyRefKey,
  packIdentityKey,
  packToDependencyRef,
  assertDependencyIdentity,
  computePackCompositionHash,
  composeDomainPack,
} from './pack-composition.js';
export type { PackResolutionSet, ComposedDomainPackResult } from './pack-composition.js';

export {
  minimalDomainPack,
  minimalEntity,
  minimalRule,
  minimalExtractionContract,
  minimalOutputSpecification,
} from './test-helpers.js';
