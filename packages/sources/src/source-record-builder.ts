import type { SourceAuthorityMetadata, SourceRecord, SourceSnapshot } from '@domain-forge/contracts';
import { sourceIdentityFromSnapshot } from '@domain-forge/contracts';

export function buildSourceRecordFromSnapshot(
  snapshot: SourceSnapshot,
  authority?: SourceAuthorityMetadata,
): SourceRecord {
  const record: SourceRecord = {
    identity: sourceIdentityFromSnapshot(snapshot),
    sourceSnapshotId: snapshot.sourceSnapshotId,
    retrieval: {
      retrievedAt: snapshot.retrievalTimestamp,
      ...(snapshot.httpStatus !== undefined ? { httpStatus: snapshot.httpStatus } : {}),
      ...(snapshot.contentType !== undefined ? { contentType: snapshot.contentType } : {}),
      finalUrl: snapshot.canonicalUrl ?? snapshot.url,
      contentLength: snapshot.rawContent.length,
    },
  };

  if (authority !== undefined) {
    return { ...record, authority };
  }
  if (snapshot.sourceTier !== undefined) {
    return {
      ...record,
      authority: {
        authorityCategory: 'unknown',
        proposedSourceTier: snapshot.sourceTier,
      },
    };
  }
  return record;
}

export function getSnapshotNormalizedText(snapshot: SourceSnapshot): string {
  return snapshot.normalizedText;
}
