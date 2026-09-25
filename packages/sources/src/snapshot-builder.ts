import { sha256Hex, asSourceSnapshotId } from '@domain-forge/core';
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
  const id = asSourceSnapshotId(`snap-${contentHash.slice(0, 16)}`);

  const snapshot: SourceSnapshot = {
    sourceSnapshotId: id,
    url: input.url,
    canonicalUrl: input.url,
    retrievalTimestamp: new Date().toISOString(),
    rawContent: input.rawContent,
    extractedRawText,
    normalizedText,
    contentHash,
    extractionVersion: EXTRACTION_VERSION,
    normalizationVersion: QUOTE_NORMALIZATION_VERSION,
  };

  if (input.metadata.title !== undefined) snapshot.title = input.metadata.title;
  if (input.metadata.httpStatus !== undefined) snapshot.httpStatus = input.metadata.httpStatus;
  if (input.metadata.contentType !== undefined) snapshot.contentType = input.metadata.contentType;
  if (input.metadata.jurisdiction !== undefined) snapshot.jurisdiction = input.metadata.jurisdiction;
  if (input.metadata.sourceTier !== undefined) snapshot.sourceTier = input.metadata.sourceTier;
  if (input.metadata.effectiveDate !== undefined) snapshot.effectiveDate = input.metadata.effectiveDate;

  return snapshot;
}

function extractText(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
