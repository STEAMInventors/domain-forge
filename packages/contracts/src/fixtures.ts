import type {
  ExtractionMissingnessState,
  OutputRuleOutcomeId,
} from '@hive/pack-contract';
import type { SourceId, SourceSnapshotId } from '@domain-forge/core';
import type { EvidenceLocator } from './evidence.js';
import type { ExtractionOutcome } from './extraction.js';
import type {
  AcceptedOutput,
  RuleOutcomeRecord,
  ValidatedClaim,
  ValidatedNarrativeStatement,
} from './output.js';
import type { AcceptedExtraction } from './extraction.js';

/** Architecture-defined fixture scenario categories — domain-neutral. */
export const FIXTURE_CATEGORIES = [
  'normal',
  'missing_information',
  'conflicting_information',
  'historical_current_ambiguity',
  'unusual_terminology',
  'adversarial',
  'synthetic',
  'real_corpus',
] as const;

export type FixtureCategory = (typeof FIXTURE_CATEGORIES)[number];

/** Distinguish synthetic test material from real corpus fixtures. */
export type FixtureMaterialClass = 'synthetic' | 'real_corpus';

export type FixturePackCompatibility =
  | { readonly mode: 'domain_independent'; readonly domainId: string }
  | { readonly mode: 'schema_version'; readonly schemaVersion: string }
  | {
      readonly mode: 'pinned_pack';
      readonly packId: string;
      readonly packVersion: string;
      readonly packContentHash: string;
    };

/** Stable source binding — resolves to Step-9 source identities, not arbitrary strings. */
export interface FixtureSourceBinding {
  readonly sourceId: SourceId;
  readonly sourceContentFingerprint: string;
  readonly sourceSnapshotId?: SourceSnapshotId;
  readonly documentTypeId: string;
  readonly documentLabel?: string;
  readonly temporalRole?: 'current' | 'historical' | 'unknown';
  readonly effectiveDate?: string;
}

export interface FixtureProvenance {
  readonly materialClass: FixtureMaterialClass;
  readonly description?: string;
  readonly generationModelProvider?: string;
  readonly generationModelFamily?: string;
  readonly generationPolicyVersion?: string;
  readonly authoredByRole?: string;
  readonly noteRef?: string;
}

/** Human approval boundary for accepted gold expectations — not Step-14 readiness decisions. */
export interface GoldApprovalRecord {
  readonly status: 'approved' | 'pending' | 'rejected';
  readonly reviewerRole: string;
  readonly reviewerRef?: string;
  readonly approvalVersion?: string;
  readonly reasonNoteRef?: string;
}

/** Expected evidence relationship — canonical binding, not incidental model prose. */
export interface GoldEvidenceExpectation {
  readonly sourceId: SourceId;
  readonly sourceContentFingerprint: string;
  readonly locator: EvidenceLocator;
  readonly quoteVerified?: boolean;
  readonly normalizedQuote?: string;
}

/** Positive, negative, or explicit missingness gold expectation for one fact extraction. */
export type GoldFactExpectation =
  | {
      readonly kind: 'present';
      readonly outcomes: readonly ExtractionOutcome[];
    }
  | {
      readonly kind: 'forbidden';
    }
  | {
      readonly kind: 'missingness';
      readonly state: ExtractionMissingnessState;
    };

/** Human-approved expected extraction outcome bound to pack definitions. */
export interface GoldFact {
  readonly id: string;
  readonly extractionContractId: string;
  readonly factId: string;
  readonly entityId?: string;
  readonly entityInstanceId?: string;
  readonly constructId?: string;
  readonly roleId?: string;
  readonly subjectId?: string;
  readonly documentTypeId?: string;
  readonly sourceBindingRef?: string;
  readonly expectation: GoldFactExpectation;
  readonly expectedEvidence?: readonly GoldEvidenceExpectation[];
  readonly approval?: GoldApprovalRecord;
}

/** Expected rule outcome — reuses registered FIRED / NOT_FIRED / UNDETERMINED semantics. */
export interface ExpectedRuleOutcome {
  readonly ruleId: string;
  readonly outcome: OutputRuleOutcomeId;
  readonly supportingFactIds?: readonly string[];
  readonly supportingChipRefs?: readonly string[];
  readonly expectedEvidence?: readonly GoldEvidenceExpectation[];
}

/** Semantic output expectation — structured, not literal prose equality. */
export interface ExpectedOutputSectionPresence {
  readonly specificationId: string;
  readonly sectionId: string;
  readonly expectation: 'present' | 'absent';
}

export interface ExpectedClaimPresence {
  readonly specificationId: string;
  readonly claimTypeId: string;
  readonly expectation: 'present' | 'forbidden';
}

export interface ExpectedOutputBehavior {
  readonly specificationId: string;
  readonly sectionPresence?: readonly ExpectedOutputSectionPresence[];
  readonly claimPresence?: readonly ExpectedClaimPresence[];
  readonly questionIds?: readonly string[];
  readonly documentTypeIds?: readonly string[];
  readonly professionalOnlySectionIds?: readonly string[];
  readonly customerTopNClaimTypeIds?: readonly string[];
  readonly urgencyClaimTypeIds?: readonly string[];
}

/** First-class forbidden artifact expectations for hallucination/adversarial testing. */
export type ForbiddenExpectation =
  | { readonly kind: 'fact'; readonly factId: string; readonly contractId?: string }
  | { readonly kind: 'claim'; readonly claimTypeId: string; readonly specificationId?: string }
  | { readonly kind: 'rule_fired'; readonly ruleId: string }
  | { readonly kind: 'output_section'; readonly specificationId: string; readonly sectionId: string }
  | {
      readonly kind: 'narrative';
      readonly specificationId?: string;
      readonly claimTypeId?: string;
      readonly sectionId?: string;
    };

/** Stable fixture identity — no runtime timestamps. */
export interface FixtureDefinition {
  readonly id: string;
  readonly domainId: string;
  readonly category: FixtureCategory;
  readonly tags: readonly string[];
  readonly sourceBindings: readonly FixtureSourceBinding[];
  readonly applicableDocumentTypeIds: readonly string[];
  readonly packCompatibility: FixturePackCompatibility;
  readonly provenance: FixtureProvenance;
  readonly goldFacts: readonly GoldFact[];
  readonly expectedRuleOutcomes: readonly ExpectedRuleOutcome[];
  readonly expectedOutput?: ExpectedOutputBehavior;
  readonly forbiddenExpectations: readonly ForbiddenExpectation[];
}

/** Multi-document fixture case with cross-document expectations. */
export interface FixtureCase {
  readonly id: string;
  readonly domainId: string;
  readonly tags: readonly string[];
  readonly fixtures: readonly FixtureDefinition[];
  readonly crossDocumentGoldFacts: readonly GoldFact[];
  readonly temporalRelationships?: readonly {
    readonly fromSourceId: SourceId;
    readonly toSourceId: SourceId;
    readonly relationship: 'supersedes' | 'conflicts_with' | 'continues' | 'unknown';
  }[];
  readonly forbiddenExpectations: readonly ForbiddenExpectation[];
}

/** Deterministic identity for a fixture corpus used during corpus binding. */
export interface FixtureCorpus {
  readonly corpusId: string;
  readonly domainId: string;
  readonly label?: string;
  readonly cases: readonly FixtureCase[];
  readonly standaloneFixtures: readonly FixtureDefinition[];
}

/** Untrusted model-proposed fixture/gold — never an accepted oracle. */
export interface ProposedFixtureBundle {
  readonly source: 'MODEL';
  readonly proposalId: string;
  readonly domainId: string;
  readonly fixtures: readonly FixtureDefinition[];
  readonly cases?: readonly FixtureCase[];
}

/** Accepted fixture/gold after schema, registry, and human approval boundaries. */
export interface AcceptedFixtureCorpus {
  readonly source: 'APPROVED';
  readonly corpus: FixtureCorpus;
  /** Deterministic hash of the approved fixture corpus — distinct from authority corpus hash. */
  readonly fixtureCorpusHash: string;
  readonly approval?: GoldApprovalRecord;
}

export type GoldEvaluationStatus =
  | 'match'
  | 'mismatch'
  | 'missing'
  | 'unexpected'
  | 'incorrect_missingness'
  | 'incorrect_evidence'
  | 'forbidden_artifact_produced';

export interface GoldEvaluationFinding {
  readonly status: GoldEvaluationStatus;
  readonly goldFactId?: string;
  readonly forbiddenKind?: ForbiddenExpectation['kind'];
  readonly ruleId?: string;
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface GoldEvaluationResult {
  readonly passed: boolean;
  readonly findings: readonly GoldEvaluationFinding[];
}

/** Validated artifacts compared against gold — never raw model text. */
export interface GoldEvaluationInput {
  readonly extractions: readonly AcceptedExtraction[];
  readonly ruleOutcomes: readonly RuleOutcomeRecord[];
  readonly claims: readonly ValidatedClaim[];
  readonly narratives: readonly ValidatedNarrativeStatement[];
  readonly output?: AcceptedOutput;
}

export interface FixtureValidationError {
  readonly code:
    | 'FIXTURE_MALFORMED'
    | 'FIXTURE_SOURCE_MISSING'
    | 'FIXTURE_FINGERPRINT_MISMATCH'
    | 'FIXTURE_INCOMPATIBLE_WITH_PACK'
    | 'FIXTURE_DUPLICATE_ID'
    | 'GOLD_FACT_DUPLICATE_ID'
    | 'GOLD_REFERENCE_UNRESOLVED'
    | 'GOLD_INVALID_VALUE'
    | 'GOLD_INVALID_EVIDENCE'
    | 'GOLD_CONTRADICTORY_EXPECTATION'
    | 'FORBIDDEN_EXPECTATION_MALFORMED'
    | 'CORPUS_MISMATCH';
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface FixtureValidationResult {
  readonly valid: boolean;
  readonly errors: readonly FixtureValidationError[];
}

export interface FixtureValidationContext {
  readonly resolveSource: (sourceId: SourceId) =>
    | { sourceContentFingerprint: string; sourceSnapshotId?: SourceSnapshotId }
    | undefined;
  readonly packContentHash?: string;
  readonly packId?: string;
  readonly packVersion?: string;
  readonly schemaVersion?: string;
  readonly domainId?: string;
}

/** Compare validated artifacts against gold expectations — assertion primitive only. */
export interface GoldEvaluator {
  evaluate(input: GoldEvaluationInput, corpus: FixtureCorpus): GoldEvaluationResult;
}
