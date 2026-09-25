import { asCertificationId } from '@domain-forge/core';
import type {
  CertificationDecision,
  CertificationRecord,
  QualificationRecord,
} from '@domain-forge/contracts';
import { computeCertificationRecordFingerprint } from './certification-fingerprint.js';

export interface CreateCertificationRecordInput {
  readonly qualificationRecord: QualificationRecord;
  readonly packCompositionHash?: string;
  readonly certificationProfileId: string;
  readonly certificationProfileVersion: string;
  readonly reviewerId: string;
  readonly reviewerRole: CertificationRecord['reviewerRole'];
  readonly reviewerCredential?: string;
  readonly decision: CertificationDecision;
  readonly notes?: string;
}

export function createCertificationRecord(
  input: CreateCertificationRecordInput,
): CertificationRecord {
  const qual = input.qualificationRecord;
  const decision: CertificationDecision =
    input.notes !== undefined && input.decision.kind === 'certified'
      ? { ...input.decision, notes: input.notes }
      : input.decision;

  const fingerprint = computeCertificationRecordFingerprint({
    packId: qual.identity.packId,
    packVersion: qual.identity.packVersion,
    packContentHash: qual.identity.packContentHash,
    ...(input.packCompositionHash !== undefined
      ? { packCompositionHash: input.packCompositionHash }
      : qual.identity.packCompositionHash !== undefined
        ? { packCompositionHash: qual.identity.packCompositionHash }
        : {}),
    domainId: qual.identity.domainId,
    qualificationRecordId: qual.id,
    qualificationRecordFingerprint: qual.recordFingerprint,
    fixtureCorpusHash: qual.identity.fixtureCorpusHash,
    ...(qual.identity.authorityCorpusHash !== undefined
      ? { authorityCorpusHash: qual.identity.authorityCorpusHash }
      : {}),
    certificationProfileId: input.certificationProfileId,
    certificationProfileVersion: input.certificationProfileVersion,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    decision,
  });

  return {
    id: asCertificationId(
      `cert-${qual.identity.packContentHash.slice(0, 12)}-${fingerprint.slice(0, 12)}`,
    ),
    packId: qual.identity.packId,
    packVersion: qual.identity.packVersion,
    packContentHash: qual.identity.packContentHash,
    ...(input.packCompositionHash !== undefined
      ? { packCompositionHash: input.packCompositionHash }
      : qual.identity.packCompositionHash !== undefined
        ? { packCompositionHash: qual.identity.packCompositionHash }
        : {}),
    domainId: qual.identity.domainId,
    qualificationRecordId: qual.id,
    qualificationRecordFingerprint: qual.recordFingerprint,
    fixtureCorpusHash: qual.identity.fixtureCorpusHash,
    ...(qual.identity.authorityCorpusHash !== undefined
      ? { authorityCorpusHash: qual.identity.authorityCorpusHash }
      : {}),
    certificationProfileId: input.certificationProfileId,
    certificationProfileVersion: input.certificationProfileVersion,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    ...(input.reviewerCredential !== undefined
      ? { reviewerCredential: input.reviewerCredential }
      : {}),
    decision,
    certifiedAt: new Date().toISOString(),
    recordFingerprint: fingerprint,
  };
}
