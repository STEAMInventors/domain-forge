import type { SourceType } from './source-identity.js';

/** Declarative classification rule — domain-neutral match criteria. */
export interface SourceClassificationRule {
  readonly id: string;
  readonly description: string;
  readonly priority: number;
  readonly match: {
    readonly sourceType?: SourceType;
    readonly authorityCategory?: 'primary' | 'secondary' | 'reference' | 'unknown';
  };
  /** Resolved tier id — must exist in SourceTierRegistry (1–6). */
  readonly tier: string;
}

/** Versioned source classification configuration. */
export interface SourceClassificationRegistry {
  readonly version: string;
  readonly rules: readonly SourceClassificationRule[];
}

export interface SourceTierResolutionInput {
  readonly proposedSourceTier?: string;
  readonly sourceType?: SourceType;
  readonly authorityCategory?: 'primary' | 'secondary' | 'reference' | 'unknown';
}

export interface SourceTierResolutionResult {
  readonly proposedSourceTier?: string;
  readonly resolvedSourceTier?: string;
  readonly ruleId?: string;
  readonly resolved: boolean;
}

export interface SourceTierResolver {
  resolve(input: SourceTierResolutionInput): SourceTierResolutionResult;
  resolveOrThrow(input: SourceTierResolutionInput): SourceTierResolutionResult & { resolvedSourceTier: string };
}
