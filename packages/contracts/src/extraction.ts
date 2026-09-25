import type {
  ExtractionCardinality,
  ExtractionContractEntry,
  ExtractionMissingnessState,
  ExtractionValueType,
} from '@hive/pack-contract';
import type { AcceptedEvidenceReference, ProposedEvidenceReference } from './evidence.js';

/** Strict typed extraction value — kind deterministically constrains shape. */
export type ExtractionValue =
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | { readonly kind: 'date'; readonly value: string }
  | { readonly kind: 'money'; readonly amount: number; readonly currency: string }
  | { readonly kind: 'duration'; readonly value: number; readonly unitId: string }
  | { readonly kind: 'quantity'; readonly value: number; readonly unitId: string }
  | { readonly kind: 'enum'; readonly value: string }
  | { readonly kind: 'reference'; readonly refId: string }
  | {
      readonly kind: 'structured_object';
      readonly fields: Readonly<Record<string, ExtractionValue>>;
    };

/** One extracted outcome — typed value or explicit missingness state. */
export type ExtractionOutcome =
  | { readonly kind: 'value'; readonly value: ExtractionValue }
  | { readonly kind: 'missingness'; readonly state: ExtractionMissingnessState };

/** Untrusted model-proposed extraction — never an accepted artifact. */
export interface ProposedExtraction {
  readonly source: 'MODEL';
  readonly contractId: string;
  readonly factId: string;
  readonly outcomes: readonly ExtractionOutcome[];
  readonly constructId?: string;
  readonly roleId?: string;
  readonly subjectId?: string;
  readonly documentTypeId?: string;
  readonly entityId?: string;
  readonly evidence: readonly ProposedEvidenceReference[];
}

/** Runtime brand — only `acceptExtractionProposal` may attach this. */
export const ACCEPTED_EXTRACTION_BRAND = Symbol('AcceptedExtraction');

/**
 * Deterministically validated extraction bound to contract and evidence.
 * Construct only via `acceptExtractionProposal` — never from raw model output.
 */
export interface AcceptedExtraction {
  readonly [ACCEPTED_EXTRACTION_BRAND]: true;
  readonly source: 'VALIDATED';
  readonly contractId: string;
  readonly factId: string;
  readonly contractEntryId: string;
  readonly expectedType: ExtractionValueType;
  readonly cardinality: ExtractionCardinality;
  readonly outcomes: readonly ExtractionOutcome[];
  readonly constructId?: string;
  readonly roleId?: string;
  readonly subjectId?: string;
  readonly documentTypeId?: string;
  readonly entityId?: string;
  readonly evidence: readonly AcceptedEvidenceReference[];
  readonly extractionHash: string;
  readonly contractContentHash: string;
}

export interface ExtractionValidationError {
  readonly code:
    | 'EXTRACTION_CONTRACT_NOT_FOUND'
    | 'EXTRACTION_CONTRACT_MALFORMED'
    | 'EXTRACTION_VALUE_TYPE_MISMATCH'
    | 'EXTRACTION_REQUIRED_VALUE_MISSING'
    | 'EXTRACTION_INVALID_CARDINALITY'
    | 'EXTRACTION_INVALID_UNIT'
    | 'EXTRACTION_UNRESOLVED_CONSTRUCT'
    | 'EXTRACTION_UNRESOLVED_ROLE'
    | 'EXTRACTION_UNRESOLVED_SUBJECT'
    | 'EXTRACTION_UNRESOLVED_REFERENCE'
    | 'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE'
    | 'EXTRACTION_MISSING_EVIDENCE'
    | 'EXTRACTION_INVALID_EVIDENCE'
    | 'EXTRACTION_MALFORMED_PROPOSAL'
    | 'EXTRACTION_GUARD_FAILURE';
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface ExtractionValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ExtractionValidationError[];
}

export interface ExtractionAcceptanceContext {
  readonly resolveContract: (contractId: string) => ExtractionContractEntry | undefined;
  readonly resolveFact: (factId: string) => { id: string; entityId: string } | undefined;
  readonly resolveEntity: (entityId: string) => { id: string } | undefined;
  readonly resolveDocumentType: (documentTypeId: string) => { id: string } | undefined;
  readonly resolveVocabulary: (termId: string) => { id: string } | undefined;
  readonly contractContentHash: (contract: ExtractionContractEntry) => string;
}

/** Stage artifact content for validated extraction outputs. */
export interface ExtractionStageArtifact {
  readonly artifactType: 'extraction';
  readonly contractId: string;
  readonly accepted: AcceptedExtraction;
}

export function isAcceptedExtraction(value: unknown): value is AcceptedExtraction {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AcceptedExtraction).source === 'VALIDATED' &&
    ACCEPTED_EXTRACTION_BRAND in value
  );
}

export function isProposedExtraction(value: unknown): value is ProposedExtraction {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ProposedExtraction).source === 'MODEL' &&
    typeof (value as ProposedExtraction).contractId === 'string'
  );
}
