import type { ForgeRunId, HumanReviewId } from './ids.js';

export type HumanGateType = 'STAGE_0_APPROVAL' | 'CERTIFICATION' | 'NEEDS_REVIEW' | 'BUDGET_OVERRIDE';

export interface HumanGateRecord {
  id: HumanReviewId;
  forgeRunId: ForgeRunId;
  gateType: HumanGateType;
  stageId?: string;
  reviewerId: string;
  reviewerRole: string;
  decision: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  notes?: string;
  timestamp: string;
}

export function hasStage0Approval(records: readonly HumanGateRecord[]): boolean {
  return records.some(
    (r) => r.gateType === 'STAGE_0_APPROVAL' && r.decision === 'APPROVED',
  );
}
