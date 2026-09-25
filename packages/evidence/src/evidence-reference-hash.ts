import { hashObject } from '@domain-forge/core';
import type { AcceptedEvidenceReference, EvidenceContent, EvidenceLocator } from '@domain-forge/contracts';

export function computeEvidenceReferenceHash(input: {
  sourceId: string;
  sourceContentFingerprint: string;
  locator: EvidenceLocator;
  content?: EvidenceContent | undefined;
}): string {
  const payload: Record<string, unknown> = {
    sourceId: input.sourceId,
    sourceContentFingerprint: input.sourceContentFingerprint,
    locator: input.locator,
  };
  if (input.content !== undefined) {
    payload['content'] = {
      kind: input.content.kind,
      text: input.content.text,
      excerptHash: input.content.excerptHash,
    };
  }
  return hashObject(payload);
}

export function assertEvidenceReferenceImmutable(
  existing: AcceptedEvidenceReference,
  updated: AcceptedEvidenceReference,
): void {
  if (existing.evidenceReferenceHash !== updated.evidenceReferenceHash) {
    throw new Error(
      'Evidence reference identity changed — create a new evidence artifact instead of mutating an existing record',
    );
  }
  if (existing.sourceContentFingerprint !== updated.sourceContentFingerprint) {
    throw new Error('Evidence reference cannot change bound source fingerprint');
  }
}
