export { RegistryError, type RegistryErrorCode, type RegistryErrorDetails } from './registry-error.js';
export {
  buildRegistry,
  assertRegistryReferences,
  type RegistryEntryDefinition,
  type ResolvedRegistryEntry,
  type ImmutableRegistry,
  type BuildRegistryOptions,
} from './registry.js';

export {
  PRIMITIVE_DEFINITIONS,
  GRAMMAR_DEFINITIONS,
  ARCHETYPE_DEFINITIONS,
  COMPOSITION_DEFINITIONS,
  TIME_MODEL_DEFINITIONS,
  IDENTITY_STRATEGY_DEFINITIONS,
  RULE_OUTCOME_DEFINITIONS,
  OUTPUT_SECTION_TYPE_DEFINITIONS,
  SOURCE_TIER_DEFINITIONS,
  REVIEWER_ROLE_DEFINITIONS,
  type PrimitiveId,
  type GrammarTypeId,
  type ArchetypeId,
  type CompositionStrategyId,
  type TimeModelId,
  type IdentityStrategyId,
  type RuleOutcomeId,
  type OutputSectionTypeId,
  type SourceTierId,
  type ReviewerRoleId,
} from './system-definitions.js';

export {
  PrimitiveRegistry,
  GrammarRegistry,
  CoreGrammarRegistry,
  ArchetypeRegistry,
  CompositionRegistry,
  TimeModelRegistry,
  IdentityStrategyRegistry,
  RuleOutcomeRegistry,
  OutputSectionTypeRegistry,
  SourceTierRegistry,
  ReviewerRoleRegistry,
  SystemRegistries,
} from './system-registries.js';

export {
  QuestionLanguageRegistry,
  QUESTION_LANGUAGE_VERSION,
  findBannedQuestionLanguage,
  isBannedQuestionLanguage,
  acceptQuestionLanguageEntry,
  type QuestionLanguageEntry,
  type QuestionLanguageRestriction,
  type ProposedQuestionLanguageEntry,
} from './question-language-registry.js';

export {
  createPackRegistries,
  type PackRegistries,
  type PackEntryRegistry,
  type PackRegistrySection,
} from './pack-registries.js';

