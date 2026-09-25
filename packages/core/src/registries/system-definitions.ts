import type { RegistryEntryDefinition } from './registry.js';

export const PRIMITIVE_DEFINITIONS = [
  { id: 'REQUIRE', description: 'Require a fact or condition to hold' },
  { id: 'COMPARE', description: 'Compare values against a threshold or reference' },
  { id: 'CONSISTENT', description: 'Assert consistency across entities or facts' },
  { id: 'LINK', description: 'Link entities via declared relationships' },
  { id: 'SERIES', description: 'Evaluate a series of events or values' },
  { id: 'WINDOW', description: 'Evaluate within a time window' },
] as const satisfies readonly RegistryEntryDefinition[];

export type PrimitiveId = (typeof PRIMITIVE_DEFINITIONS)[number]['id'];

export const GRAMMAR_DEFINITIONS = [
  { id: 'Party', description: 'Actor or stakeholder entity' },
  { id: 'Obligation', description: 'Binding obligation entity' },
  { id: 'Claim', description: 'Asserted claim entity' },
  { id: 'Evidence', description: 'Supporting evidence entity' },
  { id: 'Money', description: 'Monetary amount entity' },
  { id: 'Time', description: 'Temporal entity or period' },
] as const satisfies readonly RegistryEntryDefinition[];

export type GrammarTypeId = (typeof GRAMMAR_DEFINITIONS)[number]['id'];

export const ARCHETYPE_DEFINITIONS = [
  { id: 'plan-and-progress', description: 'Plan tracking with progress milestones' },
  { id: 'ledger', description: 'Ledger-style accumulation and adjustment' },
  { id: 'claim-and-evidence', description: 'Claims supported by evidence artifacts' },
  { id: 'contract-and-performance', description: 'Contract obligations and performance' },
] as const satisfies readonly RegistryEntryDefinition[];

export type ArchetypeId = (typeof ARCHETYPE_DEFINITIONS)[number]['id'];

export const COMPOSITION_DEFINITIONS = [
  { id: 'supersede_amend', description: 'New data supersedes or amends prior' },
  { id: 'ledger_adjust', description: 'Adjust ledger entries' },
  { id: 'accumulate', description: 'Accumulate values over time' },
  { id: 'snapshot', description: 'Point-in-time snapshot composition' },
] as const satisfies readonly RegistryEntryDefinition[];

export type CompositionStrategyId = (typeof COMPOSITION_DEFINITIONS)[number]['id'];

export const TIME_MODEL_DEFINITIONS = [
  { id: 'calendar_day', description: 'Standard calendar day counting' },
  { id: 'business_day', description: 'Business day excluding weekends/holidays' },
  { id: 'school_day', description: 'School instructional day counting' },
  { id: 'court_day', description: 'Court-scheduled day counting' },
  { id: 'benefit_period', description: 'Benefit eligibility period boundaries' },
] as const satisfies readonly RegistryEntryDefinition[];

export type TimeModelId = (typeof TIME_MODEL_DEFINITIONS)[number]['id'];

export const IDENTITY_STRATEGY_DEFINITIONS = [
  { id: 'external_id', description: 'Match by external system identifier' },
  { id: 'composite_key', description: 'Match by composite key fields' },
  { id: 'reviewed_fuzzy_match', description: 'Fuzzy match requiring human review' },
] as const satisfies readonly RegistryEntryDefinition[];

export type IdentityStrategyId = (typeof IDENTITY_STRATEGY_DEFINITIONS)[number]['id'];

export const RULE_OUTCOME_DEFINITIONS = [
  { id: 'FIRED', description: 'Rule conditions satisfied' },
  { id: 'NOT_FIRED', description: 'Rule conditions not satisfied' },
  { id: 'UNDETERMINED', description: 'Insufficient data to determine outcome' },
] as const satisfies readonly RegistryEntryDefinition[];

export type RuleOutcomeId = (typeof RULE_OUTCOME_DEFINITIONS)[number]['id'];

export const OUTPUT_SECTION_TYPE_DEFINITIONS = [
  { id: 'FINDINGS_LIST', description: 'Ordered list of validated findings' },
  { id: 'ENTITY_TABLE', description: 'Tabular entity presentation' },
  { id: 'TIMELINE', description: 'Chronological event presentation' },
  { id: 'QUESTION_LIST', description: 'Structured question list' },
  { id: 'DOCUMENT_REQUESTS', description: 'Requested document list' },
  { id: 'CASE_SNAPSHOT', description: 'High-level case summary snapshot' },
] as const satisfies readonly RegistryEntryDefinition[];

export type OutputSectionTypeId = (typeof OUTPUT_SECTION_TYPE_DEFINITIONS)[number]['id'];

/** Source tiers 1 (highest authority) through 6 (lowest) */
export const SOURCE_TIER_DEFINITIONS = [
  { id: '1', description: 'Primary statutory or regulatory authority' },
  { id: '2', description: 'Official agency guidance or rulemaking' },
  { id: '3', description: 'Authoritative secondary publication' },
  { id: '4', description: 'Professional or industry standard reference' },
  { id: '5', description: 'Tertiary explanatory material' },
  { id: '6', description: 'Discovery aid — not authoritative until snapshotted' },
] as const satisfies readonly RegistryEntryDefinition[];

export type SourceTierId = (typeof SOURCE_TIER_DEFINITIONS)[number]['id'];

export const REVIEWER_ROLE_DEFINITIONS = [
  { id: 'FOUNDER_PRODUCT_OWNER', description: 'Founder or product owner authorization' },
  { id: 'DOMAIN_EXPERT', description: 'Domain subject matter expert' },
  { id: 'LICENSED_ATTORNEY', description: 'Licensed attorney reviewer' },
  { id: 'BENEFITS_NAVIGATOR', description: 'Benefits navigation specialist' },
  { id: 'PROFESSIONAL_ADVOCATE', description: 'Professional advocate reviewer' },
  { id: 'CLINICAL_EXPERT', description: 'Clinical domain expert' },
  { id: 'EDUCATION_EXPERT', description: 'Education domain expert' },
] as const satisfies readonly RegistryEntryDefinition[];

export type ReviewerRoleId = (typeof REVIEWER_ROLE_DEFINITIONS)[number]['id'];
