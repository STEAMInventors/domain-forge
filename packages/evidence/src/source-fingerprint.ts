import { sha256Hex, hashObject } from '@domain-forge/core';
import type { SourceContentFingerprint, SourceIdentity } from '@domain-forge/contracts';

export const SOURCE_FINGERPRINT_ALGORITHM = 'sha256' as const;

/** Hash raw source text/binary — distinct from packContentHash */
export function computeRawContentFingerprint(content: string | Buffer): SourceContentFingerprint {
  return {
    algorithm: SOURCE_FINGERPRINT_ALGORITHM,
    hash: sha256Hex(content),
    representation: 'raw_content',
  };
}

/** Hash normalized text used for quote verification */
export function computeNormalizedTextFingerprint(
  normalizedText: string,
  versions: { normalizationVersion: string; extractionVersion?: string },
): SourceContentFingerprint {
  const fingerprint: SourceContentFingerprint = {
    algorithm: SOURCE_FINGERPRINT_ALGORITHM,
    hash: sha256Hex(normalizedText),
    representation: 'normalized_text',
    normalizationVersion: versions.normalizationVersion,
  };
  if (versions.extractionVersion !== undefined) {
    return { ...fingerprint, extractionVersion: versions.extractionVersion };
  }
  return fingerprint;
}

/** Deterministic stable identity hash — excludes retrieval metadata */
export function computeSourceIdentityHash(identity: SourceIdentity): string {
  return hashObject({
    sourceId: identity.sourceId,
    sourceType: identity.sourceType,
    title: identity.title,
    locator: identity.locator,
    publisher: identity.publisher,
    issuingAuthority: identity.issuingAuthority,
    version: identity.version,
    effectiveDate: identity.effectiveDate,
    jurisdiction: identity.jurisdiction,
    contentFingerprint: identity.contentFingerprint,
  });
}

export function computeExcerptHash(exactText: string): string {
  return sha256Hex(exactText);
}
