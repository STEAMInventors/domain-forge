import type {
  CertificationId,
  PackId,
  PackVersionTransitionRecord,
  QualificationRecordId,
  ReviewerRoleId,
} from '@domain-forge/core';
import type { QualificationRecord, QualificationStalenessEvaluator } from './qualification.js';
import type { PackVersion } from './pack.js';

/** Explicit certification decision — not a loose boolean. */
export type CertificationDecisionKind =
  | 'certified'
  | 'rejected'
  | 'requires_review'
  | 'blocked';

export interface CertificationFinding {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface CertificationDecision {
  readonly kind: CertificationDecisionKind;
  readonly findings?: readonly CertificationFinding[];
  readonly notes?: string;
}

/** Immutable human RuleCertification record — binds to exact pack identity. */
export interface CertificationRecord {
  readonly id: CertificationId;
  readonly packId: PackId;
  readonly packVersion: string;
  readonly packContentHash: string;
  readonly packCompositionHash?: string;
  readonly domainId: string;
  readonly qualificationRecordId: QualificationRecordId;
  readonly qualificationRecordFingerprint: string;
  readonly fixtureCorpusHash: string;
  readonly authorityCorpusHash?: string;
  readonly certificationProfileId: string;
  readonly certificationProfileVersion: string;
  readonly reviewerId: string;
  readonly reviewerRole: ReviewerRoleId;
  readonly reviewerCredential?: string;
  readonly decision: CertificationDecision;
  readonly certifiedAt: string;
  readonly recordFingerprint: string;
}

export type CertificationErrorCode =
  | 'QUALIFICATION_MISSING'
  | 'QUALIFICATION_STALE'
  | 'QUALIFICATION_FAILED'
  | 'QUALIFICATION_INCOMPLETE'
  | 'QUALIFICATION_REQUIRES_REVIEW'
  | 'QUALIFICATION_BLOCKED'
  | 'PACK_HASH_MISMATCH'
  | 'COMPOSITION_HASH_MISMATCH'
  | 'FIXTURE_CORPUS_MISMATCH'
  | 'AUTHORITY_CORPUS_MISMATCH'
  | 'QUALIFICATION_FINGERPRINT_MISMATCH'
  | 'CERTIFICATION_PROFILE_MISSING'
  | 'CERTIFICATION_PROFILE_MISMATCH'
  | 'APPROVER_MISSING'
  | 'REVIEWER_ROLE_INVALID'
  | 'REVIEWER_ROLE_NOT_PERMITTED'
  | 'UNRESOLVED_MANDATORY_REVIEW'
  | 'COMPLETENESS_VALIDATOR_FAILED'
  | 'LAYER_A_REQUIREMENT_NOT_MET'
  | 'LAYER_B_REQUIREMENT_NOT_MET'
  | 'CERTIFICATION_BLOCKED'
  | 'CERTIFICATION_RECORD_MALFORMED'
  | 'LIFECYCLE_PREREQUISITE_INVALID'
  | 'CERTIFICATION_STALE';

export interface CertificationError {
  readonly code: CertificationErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface CertificationPrerequisiteEvaluation {
  readonly canCertify: boolean;
  readonly decision: CertificationDecision;
  readonly errors: readonly CertificationError[];
}

export type CertificationStalenessReason =
  | 'PACK_CONTENT_HASH_CHANGED'
  | 'PACK_COMPOSITION_HASH_CHANGED'
  | 'QUALIFICATION_RECORD_FINGERPRINT_CHANGED'
  | 'FIXTURE_CORPUS_HASH_CHANGED'
  | 'AUTHORITY_CORPUS_HASH_CHANGED'
  | 'CERTIFICATION_PROFILE_VERSION_CHANGED';

export interface CertificationStalenessEvaluation {
  readonly isStale: boolean;
  readonly reasons: readonly CertificationStalenessReason[];
  readonly evaluatedAt: string;
}

/** Versioned declarative certification profile — exact id+version only. */
export interface CertificationProfile {
  readonly id: string;
  readonly version: string;
  readonly requiredQualificationProfiles: readonly {
    readonly id: string;
    readonly version: string;
  }[];
  readonly layerARequired: boolean;
  readonly layerBRequired: boolean;
  readonly requiredReviewerRoles: readonly ReviewerRoleId[];
  readonly requiredCompletenessValidators: readonly (
    | 'extraction-contract-completeness'
    | 'output-specification-completeness'
  )[];
  readonly permitUnresolvedReviewItems: boolean;
}

export interface CertificationProfileLoader {
  load(profileId: string, profileVersion: string): CertificationProfile | undefined;
}

export interface CertificationStalenessEvaluator {
  evaluate(
    record: CertificationRecord,
    current: {
      readonly packContentHash: string;
      readonly packCompositionHash?: string;
      readonly qualificationRecordFingerprint: string;
      readonly fixtureCorpusHash: string;
      readonly authorityCorpusHash?: string;
      readonly certificationProfileId: string;
      readonly certificationProfileVersion: string;
    },
  ): CertificationStalenessEvaluation;
}

/** Runtime capability supplied by Hive — not model-determined. */
export interface RuntimeCapability {
  readonly capabilityId: string;
  readonly version: string;
}

/** Pack-declared runtime capability requirement. */
export interface PackCapabilityRequirement {
  readonly id: string;
  readonly capabilityId: string;
  readonly minVersion: string;
  readonly feature?: string;
}

export type RuntimeEligibilityStatus = 'eligible' | 'ineligible';

export type RuntimeEligibilityReasonCode =
  | 'PACK_NOT_CERTIFIED'
  | 'CERTIFICATION_MISSING'
  | 'CERTIFICATION_NOT_CERTIFIED'
  | 'CERTIFICATION_STALE'
  | 'CERTIFICATION_PACK_MISMATCH'
  | 'QUALIFICATION_MISMATCH'
  | 'QUALIFICATION_STALE'
  | 'EXTRACTION_QUALIFICATION_NOT_QUALIFIED'
  | 'EXTRACTION_QUALIFICATION_STALE'
  | 'PACK_SUSPENDED'
  | 'PACK_SUPERSEDED'
  | 'RUNTIME_CAPABILITY_MISSING'
  | 'DEPENDENCY_NOT_ELIGIBLE';

export interface RuntimeEligibilityReason {
  readonly code: RuntimeEligibilityReasonCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface RuntimeEligibilityDecision {
  readonly status: RuntimeEligibilityStatus;
  readonly reasons: readonly RuntimeEligibilityReason[];
  readonly eligibilityFingerprint?: string;
  readonly evaluatedAt: string;
}

export interface RuntimeEligibilityContext {
  readonly suppliedCapabilities: readonly RuntimeCapability[];
  readonly hiveVersion: string;
  readonly extractionModelFamily?: string;
  readonly extractionModelVersion?: string;
  readonly extractionPolicyVersion?: string;
  readonly packCompositionHash?: string;
  readonly dependencyEligibility?: ReadonlyMap<string, RuntimeEligibilityDecision>;
  readonly qualificationStalenessEvaluator?: QualificationStalenessEvaluator;
  readonly currentQualificationRecord?: QualificationRecord;
}

export interface CertifyPackVersionInput {
  readonly packVersion: PackVersion;
  readonly qualificationRecord: QualificationRecord;
  readonly certificationProfileId: string;
  readonly certificationProfileVersion: string;
  readonly reviewerId: string;
  readonly reviewerRole: ReviewerRoleId;
  readonly reviewerCredential?: string;
  readonly notes?: string;
  readonly packCompositionHash?: string;
}

export interface CertifyPackVersionResult {
  readonly certification?: CertificationRecord;
  readonly packVersion?: PackVersion;
  readonly transitionRecord?: PackVersionTransitionRecord;
  readonly prerequisiteEvaluation: CertificationPrerequisiteEvaluation;
}
