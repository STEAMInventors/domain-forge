import { hashObject } from '@domain-forge/core';
import type { CertificationDecision, CertificationRecord } from '@domain-forge/contracts';

/** Deterministic fingerprint — excludes record id and timestamps. */
export function computeCertificationRecordFingerprint(input: {
  packId: CertificationRecord['packId'];
  packVersion: string;
  packContentHash: string;
  packCompositionHash?: string;
  domainId: string;
  qualificationRecordId: CertificationRecord['qualificationRecordId'];
  qualificationRecordFingerprint: string;
  fixtureCorpusHash: string;
  authorityCorpusHash?: string;
  certificationProfileId: string;
  certificationProfileVersion: string;
  reviewerId: string;
  reviewerRole: CertificationRecord['reviewerRole'];
  decision: CertificationDecision;
}): string {
  return hashObject({
    packId: input.packId,
    packVersion: input.packVersion,
    packContentHash: input.packContentHash,
    packCompositionHash: input.packCompositionHash,
    domainId: input.domainId,
    qualificationRecordId: input.qualificationRecordId,
    qualificationRecordFingerprint: input.qualificationRecordFingerprint,
    fixtureCorpusHash: input.fixtureCorpusHash,
    authorityCorpusHash: input.authorityCorpusHash,
    certificationProfileId: input.certificationProfileId,
    certificationProfileVersion: input.certificationProfileVersion,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    decision: input.decision,
  });
}

export function computeRuntimeEligibilityFingerprint(input: {
  packContentHash: string;
  certificationRecordFingerprint: string;
  hiveVersion: string;
  extractionModelFamily?: string;
  extractionModelVersion?: string;
  extractionPolicyVersion?: string;
  packCompositionHash?: string;
}): string {
  return hashObject({
    packContentHash: input.packContentHash,
    certificationRecordFingerprint: input.certificationRecordFingerprint,
    hiveVersion: input.hiveVersion,
    extractionModelFamily: input.extractionModelFamily,
    extractionModelVersion: input.extractionModelVersion,
    extractionPolicyVersion: input.extractionPolicyVersion,
    packCompositionHash: input.packCompositionHash,
  });
}
