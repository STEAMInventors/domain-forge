import type { CapabilityGapId } from './ids.js';

export type CapabilityGapStatus = 'OPEN' | 'RESOLVED' | 'DEFERRED';

export interface CapabilityGap {
  id: CapabilityGapId;
  requestedCapability: string;
  whyNeeded: string;
  supportingEvidence: string[];
  affectedArtifactOrRule: string;
  status: CapabilityGapStatus;
}

export function hasOpenCapabilityGaps(gaps: readonly CapabilityGap[]): boolean {
  return gaps.some((g) => g.status === 'OPEN');
}
