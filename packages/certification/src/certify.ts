import { asCertificationId, transitionPackVersion, InvariantViolationError } from '@domain-forge/core';
import type { CertificationRecord, PackVersion } from '@domain-forge/contracts';
import { CertificationValidator } from '@domain-forge/validation';

export const CERTIFICATION_POLICY_VERSION = '1.0.0';

export interface CertifyPackInput {
  packVersion: PackVersion;
  reviewerId: string;
  reviewerRole: string;
  reviewerCredential?: string;
  notes?: string;
}

export function certifyProvisionalPack(input: CertifyPackInput): {
  certification: CertificationRecord;
  packVersion: PackVersion;
} {
  if (input.packVersion.state !== 'PROVISIONAL') {
    throw new InvariantViolationError(
      `Cannot certify pack in state ${input.packVersion.state}; must be PROVISIONAL`,
    );
  }

  const certification: CertificationRecord = {
    id: asCertificationId(`cert-${input.packVersion.packContentHash.slice(0, 16)}`),
    packId: input.packVersion.packId,
    packVersion: input.packVersion.version,
    packContentHash: input.packVersion.packContentHash,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    decision: 'CERTIFIED',
    timestamp: new Date().toISOString(),
    certificationPolicyVersion: CERTIFICATION_POLICY_VERSION,
  };

  if (input.reviewerCredential !== undefined) {
    certification.reviewerCredential = input.reviewerCredential;
  }
  if (input.notes !== undefined) {
    certification.notes = input.notes;
  }

  const validator = new CertificationValidator();
  const result = validator.validate({
    packContentHash: input.packVersion.packContentHash,
    certificationHash: certification.packContentHash,
    decision: certification.decision,
  });

  if (!result.passed) {
    throw new InvariantViolationError('Certification validation failed', {
      errors: result.errors,
    });
  }

  const certifiedPack = {
    ...input.packVersion,
    state: transitionPackVersion('PROVISIONAL', 'CERTIFIED'),
    updatedAt: new Date().toISOString(),
  };

  return { certification, packVersion: certifiedPack };
}

/** Modified pack content invalidates prior certification applicability */
export function certificationApplies(
  certification: CertificationRecord,
  currentPackContentHash: string,
): boolean {
  return certification.packContentHash === currentPackContentHash;
}
