import type { SourceId, SourceSnapshotId } from '@domain-forge/core';
import type { SourceIdentity, SourceRecord } from './source-identity.js';

export type { SourceIdentity, SourceRecord, SourceAuthorityMetadata, SourceContentFingerprint, SourceLocator, SourceRetrievalRecord, SourceType } from './source-identity.js';
export { SOURCE_TYPES } from './source-identity.js';

/**
 * Operational snapshot of retrieved source content.
 * Links to stable SourceIdentity; retrieval/extraction/normalization are separate from evidence.
 */
export interface SourceSnapshot {
  readonly sourceSnapshotId: SourceSnapshotId;
  readonly sourceId: SourceId;
  readonly url: string;
  readonly canonicalUrl?: string;
  readonly title?: string;
  readonly retrievalTimestamp: string;
  readonly httpStatus?: number;
  readonly httpHeaders?: Record<string, string>;
  readonly contentType?: string;
  readonly rawContent: string;
  readonly rawContentRef?: string;
  readonly extractedRawText: string;
  readonly normalizedText: string;
  readonly contentHash: string;
  readonly extractionVersion: string;
  readonly normalizationVersion: string;
  readonly jurisdiction?: string;
  readonly sourceTier?: string;
  readonly effectiveDate?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]>;
}

export interface SourceRetrievalMetadata {
  url: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  contentLength: number;
  retrievedAt: string;
}

export interface SourceRetriever {
  fetch(url: string): Promise<{ content: string; metadata: SourceRetrievalMetadata }>;
}

export interface SourceSnapshotStore {
  save(snapshot: SourceSnapshot): Promise<void>;
  get(id: SourceSnapshotId): Promise<SourceSnapshot | undefined>;
  getByHash(hash: string): Promise<SourceSnapshot | undefined>;
}

export interface SourceRegistry {
  save(record: SourceRecord): Promise<void>;
  get(sourceId: SourceId): Promise<SourceRecord | undefined>;
  getByFingerprint(fingerprint: string): Promise<SourceRecord | undefined>;
}

/** Derive stable source identity fields from an operational snapshot */
export function sourceIdentityFromSnapshot(snapshot: SourceSnapshot): SourceIdentity {
  return {
    sourceId: snapshot.sourceId,
    sourceType: 'web_snapshot',
    ...(snapshot.title !== undefined ? { title: snapshot.title } : {}),
    locator: {
      kind: 'url',
      url: snapshot.url,
      ...(snapshot.canonicalUrl !== undefined ? { canonicalUrl: snapshot.canonicalUrl } : {}),
    },
    ...(snapshot.jurisdiction !== undefined ? { jurisdiction: snapshot.jurisdiction } : {}),
    ...(snapshot.effectiveDate !== undefined ? { effectiveDate: snapshot.effectiveDate } : {}),
    contentFingerprint: {
      algorithm: 'sha256',
      hash: snapshot.contentHash,
      representation: 'normalized_text',
      normalizationVersion: snapshot.normalizationVersion,
      extractionVersion: snapshot.extractionVersion,
    },
  };
}
