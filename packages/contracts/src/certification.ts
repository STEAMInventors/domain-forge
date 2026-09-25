import type { CertificationId, PackId } from '@domain-forge/core';

export interface CertificationRecord {
  id: CertificationId;
  packId: PackId;
  packVersion: string;
  packContentHash: string;
  reviewerId: string;
  reviewerRole: string;
  reviewerCredential?: string;
  decision: 'CERTIFIED' | 'REJECTED';
  notes?: string;
  timestamp: string;
  certificationPolicyVersion: string;
}
