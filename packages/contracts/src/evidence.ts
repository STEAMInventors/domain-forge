import type { EvidenceId, SourceId } from '@domain-forge/core';

/** Machine-readable evidence locators — exactly one primary locator per reference */
export type EvidenceLocator =
  | {
      readonly kind: 'page';
      readonly page: number;
    }
  | {
      readonly kind: 'line_range';
      readonly startLine: number;
      readonly endLine: number;
    }
  | {
      readonly kind: 'section';
      readonly heading: string;
      readonly level?: number;
    }
  | {
      readonly kind: 'paragraph';
      readonly index: number;
    }
  | {
      readonly kind: 'character_span';
      readonly startOffset: number;
      readonly endOffset: number;
    }
  | {
      readonly kind: 'field_path';
      readonly path: string;
    }
  | {
      readonly kind: 'fragment';
      readonly fragmentId: string;
    };

/** Distinguish quoted source text from generated interpretation */
export type EvidenceContentKind = 'quoted_excerpt' | 'interpretation';

export interface EvidenceContent {
  readonly kind: EvidenceContentKind;
  /** Exact text — for quoted excerpts this is source text, never rewritten */
  readonly text: string;
  /** Normalized form after quote normalization v0 — quoted excerpts only */
  readonly normalizedText?: string;
  /** Integrity hash of exact quoted text before normalization */
  readonly excerptHash?: string;
}

/** Untrusted model-proposed evidence — raw citations never bypass validation */
export interface ProposedEvidenceReference {
  readonly source: 'MODEL';
  readonly evidenceId?: string;
  readonly sourceId: string;
  readonly locator: EvidenceLocator;
  readonly content?: EvidenceContent;
  /** Free-text citation from model output — never accepted without deterministic validation */
  readonly rawCitation?: string;
}

/** Deterministically validated evidence bound to source fingerprint at acceptance time */
export interface AcceptedEvidenceReference {
  readonly source: 'VALIDATED';
  readonly evidenceId: EvidenceId;
  readonly sourceId: SourceId;
  readonly sourceContentFingerprint: string;
  readonly locator: EvidenceLocator;
  readonly content?: EvidenceContent;
  readonly quoteVerified: boolean;
  readonly normalizedQuote?: string;
  readonly evidenceReferenceHash: string;
}

export type StageEvidenceReference = AcceptedEvidenceReference;

/** Traceability from an accepted artifact element back to source material */
export interface ProvenanceChain {
  readonly targetRef: string;
  readonly evidenceId: EvidenceId;
  readonly sourceId: SourceId;
  readonly sourceContentFingerprint: string;
  readonly sourceVersion?: string;
  readonly effectiveDate?: string;
}

export interface EvidenceValidationError {
  readonly code:
    | 'EVIDENCE_REFERENCE_INVALID'
    | 'EVIDENCE_VERIFICATION_FAILED'
    | 'SOURCE_NOT_FOUND'
    | 'EVIDENCE_LOCATOR_INVALID'
    | 'SEMANTIC_VALIDATION_ERROR';
  readonly message: string;
  readonly path?: string;
}

export interface EvidenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly EvidenceValidationError[];
}
