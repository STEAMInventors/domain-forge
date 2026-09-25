import type { PackVersionId, PackId } from '@domain-forge/core';
import type { PackVersionState } from '@domain-forge/core';
import type { CertificationRecord } from './certification.js';
import type {
  ExtractionQualificationState,
  QualificationRecord,
} from './qualification.js';

/** Resolved pack lifecycle status from authoritative persisted records — not a stored flag. */
export interface PackStatusResolution {
  readonly packVersionId: PackVersionId;
  readonly packId: PackId;
  readonly packContentHash: string;
  readonly lifecycleState: PackVersionState;
  readonly certificationRecord?: CertificationRecord;
}

/** Resolves pack lifecycle/certification status from persisted records. */
export interface PackStatusResolver {
  resolve(packVersionId: PackVersionId): Promise<PackStatusResolution | undefined>;
}

/** Resolved extraction qualification from persisted qualification evidence. */
export interface ExtractionQualificationResolution {
  readonly packId: PackId;
  readonly packContentHash: string;
  readonly state: ExtractionQualificationState;
  readonly qualificationRecord?: QualificationRecord;
  readonly isStale: boolean;
}

export interface ExtractionQualificationRuntimeContext {
  readonly hiveVersion: string;
  readonly extractionModelFamily: string;
  readonly extractionModelVersion: string;
  readonly extractionPolicyVersion: string;
  readonly packCompositionHash?: string;
}

/** Resolves extraction qualification for a runtime combination from persisted records. */
export interface ExtractionQualificationResolver {
  resolve(
    packId: PackId,
    packContentHash: string,
    runtime: ExtractionQualificationRuntimeContext,
  ): Promise<ExtractionQualificationResolution | undefined>;
}
