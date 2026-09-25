import { InvariantViolationError } from '../errors.js';

export interface RegistryEntry {
  id: string;
  description: string;
}

function createRegistry<T extends string>(
  name: string,
  entries: readonly RegistryEntry[],
): { readonly values: readonly T[]; assert(value: string): T; has(value: string): boolean } {
  const set = new Set(entries.map((e) => e.id));
  const values = entries.map((e) => e.id) as T[];

  return {
    values,
    has(value: string): boolean {
      return set.has(value);
    },
    assert(value: string): T {
      if (!set.has(value)) {
        throw new InvariantViolationError(`Unknown ${name}: ${value}`, {
          registry: name,
          value,
          code: 'BLOCKED_CAPABILITY',
        });
      }
      return value as T;
    },
  };
}

export const PrimitiveRegistry = createRegistry<'REQUIRE' | 'COMPARE' | 'CONSISTENT' | 'LINK' | 'SERIES' | 'WINDOW'>(
  'primitive',
  [
    { id: 'REQUIRE', description: 'Require a fact or condition to hold' },
    { id: 'COMPARE', description: 'Compare values against a threshold or reference' },
    { id: 'CONSISTENT', description: 'Assert consistency across entities or facts' },
    { id: 'LINK', description: 'Link entities via declared relationships' },
    { id: 'SERIES', description: 'Evaluate a series of events or values' },
    { id: 'WINDOW', description: 'Evaluate within a time window' },
  ],
);

export const ArchetypeRegistry = createRegistry<
  'plan-and-progress' | 'ledger' | 'claim-and-evidence' | 'contract-and-performance'
>(
  'archetype',
  [
    { id: 'plan-and-progress', description: 'Plan tracking with progress milestones' },
    { id: 'ledger', description: 'Ledger-style accumulation and adjustment' },
    { id: 'claim-and-evidence', description: 'Claims supported by evidence artifacts' },
    { id: 'contract-and-performance', description: 'Contract obligations and performance' },
  ],
);

export const CompositionRegistry = createRegistry<
  'supersede_amend' | 'ledger_adjust' | 'accumulate' | 'snapshot'
>(
  'composition',
  [
    { id: 'supersede_amend', description: 'New data supersedes or amends prior' },
    { id: 'ledger_adjust', description: 'Adjust ledger entries' },
    { id: 'accumulate', description: 'Accumulate values over time' },
    { id: 'snapshot', description: 'Point-in-time snapshot composition' },
  ],
);

export const TimeModelRegistry = createRegistry<
  'calendar_day' | 'business_day' | 'school_day' | 'court_day' | 'benefit_period'
>(
  'timeModel',
  [
    { id: 'calendar_day', description: 'Standard calendar day counting' },
    { id: 'business_day', description: 'Business day excluding weekends/holidays' },
    { id: 'school_day', description: 'School instructional day counting' },
    { id: 'court_day', description: 'Court-scheduled day counting' },
    { id: 'benefit_period', description: 'Benefit eligibility period boundaries' },
  ],
);

export const IdentityStrategyRegistry = createRegistry<
  'external_id' | 'composite_key' | 'reviewed_fuzzy_match'
>(
  'identityStrategy',
  [
    { id: 'external_id', description: 'Match by external system identifier' },
    { id: 'composite_key', description: 'Match by composite key fields' },
    { id: 'reviewed_fuzzy_match', description: 'Fuzzy match requiring human review' },
  ],
);

export const CoreGrammarRegistry = createRegistry<
  'Party' | 'Obligation' | 'Claim' | 'Evidence' | 'Money' | 'Time'
>(
  'grammarType',
  [
    { id: 'Party', description: 'Actor or stakeholder entity' },
    { id: 'Obligation', description: 'Binding obligation entity' },
    { id: 'Claim', description: 'Asserted claim entity' },
    { id: 'Evidence', description: 'Supporting evidence entity' },
    { id: 'Money', description: 'Monetary amount entity' },
    { id: 'Time', description: 'Temporal entity or period' },
  ],
);

export const RuleOutcomeRegistry = createRegistry<'FIRED' | 'NOT_FIRED' | 'UNDETERMINED'>(
  'ruleOutcome',
  [
    { id: 'FIRED', description: 'Rule conditions satisfied' },
    { id: 'NOT_FIRED', description: 'Rule conditions not satisfied' },
    { id: 'UNDETERMINED', description: 'Insufficient data to determine outcome' },
  ],
);

/** Source tiers 1 (highest authority) through 6 (lowest) */
export const SourceTierRegistry = createRegistry<'1' | '2' | '3' | '4' | '5' | '6'>(
  'sourceTier',
  [
    { id: '1', description: 'Primary statutory or regulatory authority' },
    { id: '2', description: 'Official agency guidance or rulemaking' },
    { id: '3', description: 'Authoritative secondary publication' },
    { id: '4', description: 'Professional or industry standard reference' },
    { id: '5', description: 'Tertiary explanatory material' },
    { id: '6', description: 'Discovery aid — not authoritative until snapshotted' },
  ],
);

export interface QuestionLanguageEntry {
  id: string;
  phrase: string;
  restriction: 'banned' | 'restricted';
  reason: string;
}

export const QuestionLanguageRegistry: {
  version: string;
  entries: readonly QuestionLanguageEntry[];
  isBanned(phrase: string): boolean;
} = {
  version: '1.0.0',
  entries: [
    { id: 'ql-001', phrase: 'always', restriction: 'banned', reason: 'Absolute certainty not permitted' },
    { id: 'ql-002', phrase: 'never', restriction: 'banned', reason: 'Absolute certainty not permitted' },
    { id: 'ql-003', phrase: 'guarantee', restriction: 'banned', reason: 'Overpromising outcome' },
    { id: 'ql-004', phrase: 'must definitely', restriction: 'restricted', reason: 'Requires authority backing' },
  ],
  isBanned(phrase: string): boolean {
    const lower = phrase.toLowerCase();
    return this.entries.some(
      (e) => e.restriction === 'banned' && lower.includes(e.phrase.toLowerCase()),
    );
  },
};
