import type { SourceSnapshotId } from '@domain-forge/core';

export interface SourceSnapshot {
  sourceSnapshotId: SourceSnapshotId;
  url: string;
  canonicalUrl?: string;
  title?: string;
  retrievalTimestamp: string;
  httpStatus?: number;
  httpHeaders?: Record<string, string>;
  contentType?: string;
  rawContent: string;
  rawContentRef?: string;
  extractedRawText: string;
  normalizedText: string;
  contentHash: string;
  extractionVersion: string;
  normalizationVersion: string;
  jurisdiction?: string;
  sourceTier?: string;
  effectiveDate?: string;
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
