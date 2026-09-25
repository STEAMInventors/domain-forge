import type {
  QualificationRecordId,
  PackId,
  ReviewerRoleId,
} from '@domain-forge/core';
import type { DomainPackV0 } from '@hive/pack-contract';
import type { PackVersion } from './pack.js';
import type {
  AcceptedFixtureCorpus,
  FixtureCategory,
  FixtureMaterialClass,
  GoldEvaluationFinding,
  GoldEvaluationResult,
} from './fixtures.js';

/** Discriminated qualification execution outcome — not a boolean pass/fail. */
export type QualificationResultStatus =
  | 'passed'
  | 'failed'
  | 'incomplete'
  | 'blocked'
  | 'requires_review';

/** Architecture-defined ExtractionQualification states (Layer B). */
export type ExtractionQualificationState =
  | 'QUALIFIED'
  | 'FAILED'
  | 'STALE'
  | 'NOT_TESTED';

export type ExecutorTrustLevel = 'TEST' | 'FAKE' | 'REAL_HIVE';

export type QualificationExecutionMode = 'FACTS_IN' | 'DOCUMENTS_IN';

export type FixtureExecutionStatus = 'completed' | 'incomplete' | 'blocked' | 'skipped';

export type QualificationStalenessReason =
  | 'PACK_CONTENT_HASH_CHANGED'
  | 'PACK_COMPOSITION_HASH_CHANGED'
  | 'FIXTURE_CORPUS_HASH_CHANGED'
  | 'AUTHORITY_CORPUS_HASH_CHANGED'
  | 'QUALIFICATION_PROFILE_VERSION_CHANGED'
  | 'EXTRACTION_RUNTIME_CHANGED';

/** Immutable identity binding for a qualification execution. */
export interface QualificationIdentityBinding {
  readonly packId: PackId;
  readonly packVersion: string;
  readonly packContentHash: string;
  readonly packCompositionHash?: string;
  readonly domainId: string;
  /** Authority/source corpus hash from pack manifest — distinct from fixture corpus. */
  readonly authorityCorpusHash?: string;
  readonly fixtureCorpusId: string;
  readonly fixtureCorpusHash: string;
  readonly qualificationProfileId: string;
  readonly qualificationProfileVersion: string;
}

export interface QualificationExecutionContext {
  readonly executionRunId: string;
  readonly executorTrustLevel: ExecutorTrustLevel;
  readonly hiveVersion: string;
  readonly hiveBuildId?: string;
  readonly executorVersion: string;
  readonly layerAMode?: QualificationExecutionMode;
  readonly layerBMode?: QualificationExecutionMode;
  readonly extractionProvider?: string;
  readonly extractionModelFamily?: string;
  readonly extractionModelVersion?: string;
  readonly extractionPolicyVersion?: string;
}

export interface FixtureExecutionResult {
  readonly fixtureId: string;
  readonly fixtureFingerprint: string;
  readonly fixtureCategory: FixtureCategory;
  readonly materialClass: FixtureMaterialClass;
  readonly executionStatus: FixtureExecutionStatus;
  readonly goldEvaluation?: GoldEvaluationResult;
  readonly unexpectedArtifacts?: readonly string[];
  readonly forbiddenArtifacts?: readonly GoldEvaluationFinding[];
  readonly evidenceMismatches?: readonly GoldEvaluationFinding[];
  readonly missingExpectations?: readonly GoldEvaluationFinding[];
  readonly runtimeFailure?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface QualificationCoverageMetrics {
  readonly totalFixtures: number;
  readonly executedFixtures: number;
  readonly passedFixtures: number;
  readonly failedFixtures: number;
  readonly incompleteFixtures: number;
  readonly skippedFixtures: number;
  readonly syntheticTotal: number;
  readonly syntheticExecuted: number;
  readonly syntheticPassed: number;
  readonly realCorpusTotal: number;
  readonly realCorpusExecuted: number;
  readonly realCorpusPassed: number;
  readonly byCategory: Readonly<
    Record<
      string,
      { readonly total: number; readonly executed: number; readonly passed: number }
    >
  >;
}

export interface PackValidationResultEntry {
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly passed: boolean;
  readonly errors?: readonly { readonly code: string; readonly message: string; readonly path?: string }[];
}

export interface QualificationReviewItem {
  readonly id: string;
  readonly kind: 'gold_approval_pending' | 'human_interpretation' | 'coverage_gap' | 'validator_failure';
  readonly message: string;
  readonly reviewerRole?: ReviewerRoleId;
  readonly reviewerRef?: string;
  readonly resolved: boolean;
}

export interface RuleQualificationResult {
  readonly status: QualificationResultStatus;
  readonly executionMode: 'FACTS_IN';
  readonly executorTrustLevel: ExecutorTrustLevel;
  readonly hiveVersion: string;
  readonly executorVersion: string;
}

export interface ExtractionQualificationResult {
  readonly state: ExtractionQualificationState;
  readonly executionMode: 'DOCUMENTS_IN';
  readonly executorTrustLevel: ExecutorTrustLevel;
  readonly hiveCoreVersion: string;
  readonly hiveBuildId?: string;
  readonly extractionProvider: string;
  readonly extractionModelFamily: string;
  readonly extractionModelVersion: string;
  readonly extractionPolicyVersion: string;
  readonly qualificationPolicyVersion: string;
}

export interface QualificationSummary {
  readonly status: QualificationResultStatus;
  readonly fixturesExecuted: number;
  readonly fixturesPassed: number;
  readonly fixturesFailed: number;
  readonly fixturesIncomplete: number;
  readonly unresolvedReviewItems: number;
  readonly failedValidatorCount: number;
  readonly fixtureCorpusHash: string;
  readonly packContentHash: string;
}

/** Immutable qualification evidence — not certification. */
export interface QualificationRecord {
  readonly id: QualificationRecordId;
  readonly identity: QualificationIdentityBinding;
  readonly execution: QualificationExecutionContext;
  readonly executedAt: string;
  readonly status: QualificationResultStatus;
  readonly ruleQualification?: RuleQualificationResult;
  readonly extractionQualification?: ExtractionQualificationResult;
  readonly fixtureResults: readonly FixtureExecutionResult[];
  readonly coverage: QualificationCoverageMetrics;
  readonly packValidationResults: readonly PackValidationResultEntry[];
  readonly reviewItems: readonly QualificationReviewItem[];
  readonly summary: QualificationSummary;
  readonly recordFingerprint: string;
}

/** Input identities and execution context for qualification — no persistence. */
export interface QualificationInput {
  readonly packVersion: PackVersion;
  readonly packCompositionHash?: string;
  readonly fixtureCorpus: AcceptedFixtureCorpus;
  readonly qualificationProfileId: string;
  readonly qualificationProfileVersion: string;
  readonly execution: QualificationExecutionContext;
  readonly fixtureExecutions: readonly FixtureExecutionResult[];
  readonly packValidationResults?: readonly PackValidationResultEntry[];
  readonly reviewItems?: readonly QualificationReviewItem[];
}

/** Structured execution outcome before record persistence. */
export interface QualificationExecutionResult {
  readonly status: QualificationResultStatus;
  readonly errors: readonly QualificationError[];
  readonly record?: QualificationRecord;
}

export interface QualificationError {
  readonly code:
    | 'PACK_NOT_ELIGIBLE'
    | 'PACK_HASH_MISMATCH'
    | 'COMPOSITION_HASH_MISMATCH'
    | 'FIXTURE_CORPUS_MISMATCH'
    | 'FIXTURE_NOT_APPROVED'
    | 'QUALIFICATION_PROFILE_MISSING'
    | 'QUALIFICATION_PROFILE_VERSION_MISMATCH'
    | 'REQUIRED_FIXTURE_MISSING'
    | 'FIXTURE_EXECUTION_INCOMPLETE'
    | 'VALIDATOR_FAILURE'
    | 'UNRESOLVED_REVIEWER_ROLE'
    | 'STALE_QUALIFICATION'
    | 'MALFORMED_QUALIFICATION_RESULT'
    | 'DUPLICATE_QUALIFICATION_IDENTITY'
    | 'UNTRUSTED_EXECUTOR'
    | 'FIXTURE_REFERENCE_MISMATCH'
    | 'CONTRADICTORY_QUALIFICATION_STATUS';
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface QualificationStalenessEvaluation {
  readonly isStale: boolean;
  readonly reasons: readonly QualificationStalenessReason[];
  readonly evaluatedAt: string;
}

/** Runs deterministic qualification checks and builds immutable records. */
export interface QualificationExecutor {
  execute(input: QualificationInput): QualificationExecutionResult;
}

/** Detects staleness of a qualification record against current immutable inputs. */
export interface QualificationStalenessEvaluator {
  evaluate(
    record: QualificationRecord,
    current: {
      readonly packContentHash: string;
      readonly packCompositionHash?: string;
      readonly fixtureCorpusHash: string;
      readonly authorityCorpusHash?: string;
      readonly qualificationProfileId: string;
      readonly qualificationProfileVersion: string;
      readonly extractionRuntime?: {
        readonly hiveVersion: string;
        readonly extractionModelFamily: string;
        readonly extractionModelVersion: string;
        readonly extractionPolicyVersion: string;
      };
    },
  ): QualificationStalenessEvaluation;
}

/** Versioned declarative qualification profile — loaded from configs/qualification. */
export interface QualificationProfile {
  readonly id: string;
  readonly version: string;
  readonly requiredFixtureCategories: readonly FixtureCategory[];
  readonly requiredMaterialClasses: readonly FixtureMaterialClass[];
  readonly requiredValidatorIds: readonly string[];
  readonly requiredCompletenessValidators: readonly (
    | 'extraction-contract-completeness'
    | 'output-specification-completeness'
  )[];
  readonly permittedExclusions: readonly string[];
  readonly humanReviewRequirements: readonly {
    readonly reviewerRole: ReviewerRoleId;
    readonly requiredForCategories?: readonly FixtureCategory[];
  }[];
  readonly coverageRequirements: {
    readonly minSyntheticFixtures?: number;
    readonly minRealCorpusFixtures?: number;
    readonly minTotalFixtures?: number;
    readonly requireAllPackFixtureReferences?: boolean;
  };
  readonly layerARequired: boolean;
  readonly layerBRequired: boolean;
  readonly requiredExecutionTrust: ExecutorTrustLevel;
  readonly allowedPackVersionStates: readonly PackVersion['state'][];
}

export interface QualificationProfileLoader {
  load(profileId: string, profileVersion: string): QualificationProfile | undefined;
}

/** Validates pack fixture references against the accepted fixture corpus used for qualification. */
export interface PackFixtureReferenceValidator {
  validate(
    pack: DomainPackV0,
    fixtureCorpus: AcceptedFixtureCorpus,
    packContentHash: string,
  ): readonly QualificationError[];
}
