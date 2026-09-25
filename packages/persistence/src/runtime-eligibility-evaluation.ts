import type { PackVersionId } from '@domain-forge/core';
import type { RuntimeEligibilityDecision } from '@domain-forge/contracts';

/** Historical runtime eligibility evaluation — audit record, not source of truth. */
export interface RuntimeEligibilityEvaluationRecord {
  readonly id: string;
  readonly packVersionId: PackVersionId;
  readonly packContentHash: string;
  readonly certificationRecordFingerprint: string;
  readonly runtimeContextFingerprint: string;
  readonly decision: RuntimeEligibilityDecision;
  readonly recordedAt: string;
}
