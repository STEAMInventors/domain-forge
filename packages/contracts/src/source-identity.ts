import type { ArtifactId, SourceId, SourceSnapshotId } from '@domain-forge/core';

/** Architecture-defined source categories — domain-neutral, not URL-only */
export const SOURCE_TYPES = [
  'web_snapshot',
  'file',
  'corpus_entry',
  'external_locator',
  'artifact',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

/** Canonical locator for a source — not all sources are URLs */
export type SourceLocator =
  | {
      readonly kind: 'url';
      readonly url: string;
      readonly canonicalUrl?: string;
    }
  | {
      readonly kind: 'file';
      readonly path: string;
      readonly mimeType?: string;
    }
  | {
      readonly kind: 'corpus';
      readonly corpusId: string;
      readonly entryId: string;
    }
  | {
      readonly kind: 'artifact';
      readonly artifactId: ArtifactId;
      readonly contentHash?: string;
    }
  | {
      readonly kind: 'reference';
      readonly referenceId: string;
      readonly referenceSystem?: string;
    };

/**
 * Immutable content fingerprint for source material.
 * Distinct from packContentHash and packCompositionHash.
 */
export interface SourceContentFingerprint {
  readonly algorithm: 'sha256';
  readonly hash: string;
  readonly representation: 'normalized_text' | 'raw_content' | 'raw_binary';
  readonly normalizationVersion?: string;
  readonly extractionVersion?: string;
}

/** Stable source identity independent of stage consumption */
export interface SourceIdentity {
  readonly sourceId: SourceId;
  readonly sourceType: SourceType;
  readonly title?: string;
  readonly locator: SourceLocator;
  readonly publisher?: string;
  readonly issuingAuthority?: string;
  readonly version?: string;
  readonly effectiveDate?: string;
  readonly jurisdiction?: string;
  readonly contentFingerprint: SourceContentFingerprint;
}

/** Authority metadata — resolved fields are code-determined, not model-certified */
export interface SourceAuthorityMetadata {
  readonly authorityCategory: 'primary' | 'secondary' | 'reference' | 'unknown';
  readonly issuingBody?: string;
  readonly jurisdiction?: string;
  readonly effectiveDate?: string;
  readonly supersededBySourceId?: SourceId;
  readonly revokedBySourceId?: SourceId;
  /** Code-resolved tier (e.g. registry tier 1–6) — authoritative for qualification */
  readonly resolvedSourceTier?: string;
  /** Model-proposed tier — not authoritative until resolved by code */
  readonly proposedSourceTier?: string;
}

export interface SourceRetrievalRecord {
  readonly retrievedAt: string;
  readonly httpStatus?: number;
  readonly contentType?: string;
  readonly finalUrl?: string;
  readonly contentLength?: number;
}

/** Full source record combining identity, authority, and optional retrieval metadata */
export interface SourceRecord {
  readonly identity: SourceIdentity;
  readonly authority?: SourceAuthorityMetadata;
  readonly retrieval?: SourceRetrievalRecord;
  readonly sourceSnapshotId?: SourceSnapshotId;
}
