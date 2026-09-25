import { sha256Hex, asSourceId, asSourceSnapshotId } from '@domain-forge/core';
import type { SourceSnapshot } from '@domain-forge/contracts';
import { normalizeQuoteV0, QUOTE_NORMALIZATION_VERSION } from '@domain-forge/evidence';

const EXTRACTION_VERSION = '0.1.0';

export interface BuildSnapshotInput {
  url: string;
  rawContent: string;
  metadata: {
    httpStatus?: number;
    contentType?: string;
    title?: string;
    jurisdiction?: string;
    sourceTier?: string;
    effectiveDate?: string;
  };
}

export function buildSourceSnapshot(input: BuildSnapshotInput): SourceSnapshot {
  const extractedRawText = extractText(input.rawContent);
  const { normalized: normalizedText } = normalizeQuoteV0(extractedRawText);
  const contentHash = sha256Hex(normalizedText);
  const sourceId = asSourceId(`src-${contentHash.slice(0, 16)}`);
  const id = asSourceSnapshotId(`snap-${contentHash.slice(0, 16)}`);

  return {
    sourceSnapshotId: id,
    sourceId,
    url: input.url,
    canonicalUrl: input.url,
    retrievalTimestamp: new Date().toISOString(),
    rawContent: input.rawContent,
    extractedRawText,
    normalizedText,
    contentHash,
    extractionVersion: EXTRACTION_VERSION,
    normalizationVersion: QUOTE_NORMALIZATION_VERSION,
    ...(input.metadata.title !== undefined ? { title: input.metadata.title } : {}),
    ...(input.metadata.httpStatus !== undefined ? { httpStatus: input.metadata.httpStatus } : {}),
    ...(input.metadata.contentType !== undefined ? { contentType: input.metadata.contentType } : {}),
    ...(input.metadata.jurisdiction !== undefined ? { jurisdiction: input.metadata.jurisdiction } : {}),
    ...(input.metadata.sourceTier !== undefined ? { sourceTier: input.metadata.sourceTier } : {}),
    ...(input.metadata.effectiveDate !== undefined ? { effectiveDate: input.metadata.effectiveDate } : {}),
  };
}

function extractText(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
