import type {
  OutputMissingnessState,
  OutputRuleOutcomeId,
  OutputSpecificationEntry,
} from '@hive/pack-contract';
import type { AcceptedEvidenceReference, ProvenanceChain } from './evidence.js';
import type { AcceptedExtraction } from './extraction.js';

/** Runtime brand — only deterministic acceptance may attach this. */
export const ACCEPTED_OUTPUT_BRAND = Symbol('AcceptedOutput');
export const VALIDATED_SUPPORT_CHIP_BRAND = Symbol('ValidatedSupportChip');
export const VALIDATED_CLAIM_BRAND = Symbol('ValidatedClaim');
export const VALIDATED_NARRATIVE_BRAND = Symbol('ValidatedNarrativeStatement');

/** Validated atomic support unit — no chip, no claim. */
export type ValidatedSupportChip =
  | {
      readonly [VALIDATED_SUPPORT_CHIP_BRAND]: true;
      readonly kind: 'extraction';
      readonly extractionHash: string;
      readonly factId: string;
      readonly contractId: string;
    }
  | {
      readonly [VALIDATED_SUPPORT_CHIP_BRAND]: true;
      readonly kind: 'rule_outcome';
      readonly ruleId: string;
      readonly outcome: OutputRuleOutcomeId;
      readonly outcomeHash: string;
    }
  | {
      readonly [VALIDATED_SUPPORT_CHIP_BRAND]: true;
      readonly kind: 'entity_instance';
      readonly entityId: string;
      readonly instanceId: string;
    }
  | {
      readonly [VALIDATED_SUPPORT_CHIP_BRAND]: true;
      readonly kind: 'evidence';
      readonly evidenceReferenceHash: string;
    };

/** Untrusted chip reference in a model proposal. */
export type ProposedSupportChipRef =
  | { readonly kind: 'extraction'; readonly extractionHash: string }
  | { readonly kind: 'rule_outcome'; readonly ruleId: string; readonly outcome: OutputRuleOutcomeId }
  | { readonly kind: 'entity_instance'; readonly entityId: string; readonly instanceId: string }
  | { readonly kind: 'evidence'; readonly evidenceReferenceHash: string };

export type ValidatedClaimStatus = 'validated' | 'undetermined' | 'rejected';

/** Untrusted model-proposed claim — never an accepted artifact. */
export interface ProposedClaim {
  readonly source: 'MODEL';
  readonly claimTypeId: string;
  readonly claimId: string;
  readonly entityId?: string;
  readonly supportRefs: readonly ProposedSupportChipRef[];
}

/** Deterministically validated claim bound to supporting chips. */
export interface ValidatedClaim {
  readonly [VALIDATED_CLAIM_BRAND]: true;
  readonly source: 'VALIDATED';
  readonly claimTypeId: string;
  readonly claimId: string;
  readonly entityId?: string;
  readonly status: ValidatedClaimStatus;
  readonly supportChips: readonly ValidatedSupportChip[];
  readonly provenance: readonly ProvenanceChain[];
  readonly claimHash: string;
}

/** Untrusted narrative wording proposed by a model. */
export interface ProposedNarrativeStatement {
  readonly source: 'MODEL';
  readonly statementId: string;
  readonly text: string;
  readonly claimRefs: readonly string[];
  readonly sectionId?: string;
  readonly isUncertaintyStatement?: boolean;
}

/** Validated narrative authorized by validated claims — no validated claim, no narrative. */
export interface ValidatedNarrativeStatement {
  readonly [VALIDATED_NARRATIVE_BRAND]: true;
  readonly source: 'VALIDATED';
  readonly statementId: string;
  readonly text: string;
  readonly claimRefs: readonly string[];
  readonly sectionId?: string;
  readonly isUncertaintyStatement: boolean;
  readonly narrativeHash: string;
}

/** Typed field value — preserves missingness vs zero vs false vs absent. */
export type OutputFieldValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'date'; readonly value: string }
  | { readonly kind: 'missingness'; readonly state: OutputMissingnessState }
  | { readonly kind: 'empty' }
  | { readonly kind: 'null_not_applicable' }
  | { readonly kind: 'reference'; readonly refId: string };

/** Section item payloads — structured, not free-form JSON. */
export interface FindingOutputItem {
  readonly itemId: string;
  readonly claimRef: string;
  readonly ruleOutcomeRef?: { readonly ruleId: string; readonly outcome: OutputRuleOutcomeId };
  readonly factId?: string;
  readonly entityId?: string;
  readonly evidenceRefs?: readonly string[];
  readonly undetermined: boolean;
}

export interface EntityTableRowOutputItem {
  readonly itemId: string;
  readonly entityInstanceId: string;
  readonly entityId: string;
  readonly fields: Readonly<Record<string, OutputFieldValue>>;
}

export interface TimelineEventOutputItem {
  readonly itemId: string;
  readonly factId: string;
  readonly extractionHash: string;
  readonly dateValue?: string;
  readonly partialDate?: { readonly year?: number; readonly month?: number; readonly day?: number };
  readonly undetermined: boolean;
}

export interface QuestionListOutputItem {
  readonly itemId: string;
  readonly questionId: string;
}

export interface DocumentRequestOutputItem {
  readonly itemId: string;
  readonly documentTypeId: string;
  readonly missingFactId?: string;
  readonly reasonKey?: string;
}

export interface CaseSnapshotOutputItem {
  readonly itemId: string;
  readonly fields: Readonly<Record<string, OutputFieldValue>>;
}

export type AcceptedSectionItem =
  | { readonly sectionType: 'FINDINGS_LIST'; readonly item: FindingOutputItem }
  | { readonly sectionType: 'ENTITY_TABLE'; readonly item: EntityTableRowOutputItem }
  | { readonly sectionType: 'TIMELINE'; readonly item: TimelineEventOutputItem }
  | { readonly sectionType: 'QUESTION_LIST'; readonly item: QuestionListOutputItem }
  | { readonly sectionType: 'DOCUMENT_REQUESTS'; readonly item: DocumentRequestOutputItem }
  | { readonly sectionType: 'CASE_SNAPSHOT'; readonly item: CaseSnapshotOutputItem };

export interface AcceptedOutputSection {
  readonly sectionId: string;
  readonly sectionType: AcceptedSectionItem['sectionType'];
  readonly items: readonly AcceptedSectionItem['item'][];
}

/** Untrusted model-proposed output assembly. */
export interface ProposedOutput {
  readonly source: 'MODEL';
  readonly specificationId: string;
  readonly sections: readonly {
    readonly sectionId: string;
    readonly items: readonly Record<string, unknown>[];
  }[];
  readonly claims: readonly ProposedClaim[];
  readonly narratives: readonly ProposedNarrativeStatement[];
}

/** Deterministically validated output artifact. */
export interface AcceptedOutput {
  readonly [ACCEPTED_OUTPUT_BRAND]: true;
  readonly source: 'VALIDATED';
  readonly specificationId: string;
  readonly specificationContentHash: string;
  readonly sections: readonly AcceptedOutputSection[];
  readonly claims: readonly ValidatedClaim[];
  readonly narratives: readonly ValidatedNarrativeStatement[];
  readonly outputHash: string;
}

export interface RuleOutcomeRecord {
  readonly ruleId: string;
  readonly outcome: OutputRuleOutcomeId;
  readonly outcomeHash: string;
}

export interface EntityInstanceRecord {
  readonly entityId: string;
  readonly instanceId: string;
}

export interface OutputValidationError {
  readonly code:
    | 'OUTPUT_SPECIFICATION_NOT_FOUND'
    | 'OUTPUT_SPECIFICATION_MALFORMED'
    | 'OUTPUT_UNSUPPORTED_SECTION_TYPE'
    | 'OUTPUT_INVALID_CLAIM'
    | 'OUTPUT_UNSUPPORTED_CLAIM'
    | 'OUTPUT_MISSING_CLAIM_SUPPORT'
    | 'OUTPUT_INVALID_NARRATIVE_LINKAGE'
    | 'OUTPUT_INVALID_SECTION_FIELD'
    | 'OUTPUT_INVALID_REFERENCE'
    | 'OUTPUT_INVALID_QUESTION_REFERENCE'
    | 'OUTPUT_INVALID_DOCUMENT_REQUEST'
    | 'OUTPUT_INVALID_CARDINALITY'
    | 'OUTPUT_INVALID_EVIDENCE'
    | 'OUTPUT_GUARD_FAILURE'
    | 'OUTPUT_MALFORMED_PROPOSAL'
    | 'OUTPUT_RULE_OUTCOME_SEMANTICS';
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface OutputValidationResult {
  readonly valid: boolean;
  readonly errors: readonly OutputValidationError[];
}

/** Context for deterministic output acceptance — validated artifacts only. */
export interface OutputAcceptanceContext {
  readonly resolveSpecification: (specificationId: string) => OutputSpecificationEntry | undefined;
  readonly specificationContentHash: (spec: OutputSpecificationEntry) => string;
  readonly resolveExtraction: (extractionHash: string) => AcceptedExtraction | undefined;
  readonly resolveRuleOutcome: (ruleId: string) => RuleOutcomeRecord | undefined;
  readonly resolveEntityInstance: (entityId: string, instanceId: string) => EntityInstanceRecord | undefined;
  readonly resolveEvidence: (evidenceReferenceHash: string) => AcceptedEvidenceReference | undefined;
  readonly buildProvenanceForChip: (chip: ValidatedSupportChip) => readonly ProvenanceChain[];
}

/** Stage artifact content for validated output. */
export interface OutputStageArtifact {
  readonly artifactType: 'output';
  readonly specificationId: string;
  readonly accepted: AcceptedOutput;
}

export function isValidatedSupportChip(value: unknown): value is ValidatedSupportChip {
  return typeof value === 'object' && value !== null && VALIDATED_SUPPORT_CHIP_BRAND in value;
}

export function isValidatedClaim(value: unknown): value is ValidatedClaim {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ValidatedClaim).source === 'VALIDATED' &&
    VALIDATED_CLAIM_BRAND in value
  );
}

export function isValidatedNarrativeStatement(value: unknown): value is ValidatedNarrativeStatement {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ValidatedNarrativeStatement).source === 'VALIDATED' &&
    VALIDATED_NARRATIVE_BRAND in value
  );
}

export function isAcceptedOutput(value: unknown): value is AcceptedOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AcceptedOutput).source === 'VALIDATED' &&
    ACCEPTED_OUTPUT_BRAND in value
  );
}

export function isProposedOutput(value: unknown): value is ProposedOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ProposedOutput).source === 'MODEL' &&
    typeof (value as ProposedOutput).specificationId === 'string'
  );
}
