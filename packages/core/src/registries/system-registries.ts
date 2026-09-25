import { buildRegistry, type ImmutableRegistry, type RegistryEntryDefinition } from './registry.js';
import {
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

export const PrimitiveRegistry: ImmutableRegistry<(typeof PRIMITIVE_DEFINITIONS)[number]> =
  buildRegistry('primitive', PRIMITIVE_DEFINITIONS);

export const GrammarRegistry: ImmutableRegistry<(typeof GRAMMAR_DEFINITIONS)[number]> =
  buildRegistry('grammarType', GRAMMAR_DEFINITIONS);

/** @deprecated Use GrammarRegistry */
export const CoreGrammarRegistry = GrammarRegistry;

export const ArchetypeRegistry: ImmutableRegistry<(typeof ARCHETYPE_DEFINITIONS)[number]> =
  buildRegistry('archetype', ARCHETYPE_DEFINITIONS);

export const CompositionRegistry: ImmutableRegistry<(typeof COMPOSITION_DEFINITIONS)[number]> =
  buildRegistry('composition', COMPOSITION_DEFINITIONS);

export const TimeModelRegistry: ImmutableRegistry<(typeof TIME_MODEL_DEFINITIONS)[number]> =
  buildRegistry('timeModel', TIME_MODEL_DEFINITIONS);

export const IdentityStrategyRegistry: ImmutableRegistry<(typeof IDENTITY_STRATEGY_DEFINITIONS)[number]> =
  buildRegistry('identityStrategy', IDENTITY_STRATEGY_DEFINITIONS);

export const RuleOutcomeRegistry: ImmutableRegistry<(typeof RULE_OUTCOME_DEFINITIONS)[number]> =
  buildRegistry('ruleOutcome', RULE_OUTCOME_DEFINITIONS);

export const OutputSectionTypeRegistry: ImmutableRegistry<(typeof OUTPUT_SECTION_TYPE_DEFINITIONS)[number]> =
  buildRegistry('outputSectionType', OUTPUT_SECTION_TYPE_DEFINITIONS);

export const SourceTierRegistry: ImmutableRegistry<(typeof SOURCE_TIER_DEFINITIONS)[number]> =
  buildRegistry('sourceTier', SOURCE_TIER_DEFINITIONS);

export const ReviewerRoleRegistry: ImmutableRegistry<(typeof REVIEWER_ROLE_DEFINITIONS)[number]> =
  buildRegistry('reviewerRole', REVIEWER_ROLE_DEFINITIONS);

export type {
  PrimitiveId,
  GrammarTypeId,
  ArchetypeId,
  CompositionStrategyId,
  TimeModelId,
  IdentityStrategyId,
  RuleOutcomeId,
  OutputSectionTypeId,
  SourceTierId,
  ReviewerRoleId,
};

/** Convenience wrappers preserving prior assert/has/values API surface. */
function legacyAdapter<T extends RegistryEntryDefinition>(registry: ImmutableRegistry<T>) {
  return {
    values: registry.list().map((e) => e.id),
    has(value: string): boolean {
      return registry.has(value);
    },
    assert(value: string): string {
      return registry.assert(value);
    },
    resolve(value: string) {
      return registry.resolve(value);
    },
    list: () => registry.list(),
    getFingerprint: () => registry.getFingerprint(),
  };
}

export const SystemRegistries = {
  primitive: legacyAdapter(PrimitiveRegistry),
  grammarType: legacyAdapter(GrammarRegistry),
  archetype: legacyAdapter(ArchetypeRegistry),
  composition: legacyAdapter(CompositionRegistry),
  timeModel: legacyAdapter(TimeModelRegistry),
  identityStrategy: legacyAdapter(IdentityStrategyRegistry),
  ruleOutcome: legacyAdapter(RuleOutcomeRegistry),
  outputSectionType: legacyAdapter(OutputSectionTypeRegistry),
  sourceTier: legacyAdapter(SourceTierRegistry),
  reviewerRole: legacyAdapter(ReviewerRoleRegistry),
} as const;
