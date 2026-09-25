/** Branded identifier types for type safety */
export type ForgeRunId = string & { readonly __brand: 'ForgeRunId' };
export type PackId = string & { readonly __brand: 'PackId' };
export type PackVersionId = string & { readonly __brand: 'PackVersionId' };
export type StageExecutionId = string & { readonly __brand: 'StageExecutionId' };
export type StageAttemptId = string & { readonly __brand: 'StageAttemptId' };
export type ArtifactId = string & { readonly __brand: 'ArtifactId' };
export type SourceId = string & { readonly __brand: 'SourceId' };
export type SourceSnapshotId = string & { readonly __brand: 'SourceSnapshotId' };
export type EvidenceId = string & { readonly __brand: 'EvidenceId' };
export type CertificationId = string & { readonly __brand: 'CertificationId' };
export type QualificationRecordId = string & { readonly __brand: 'QualificationRecordId' };
export type HumanReviewId = string & { readonly __brand: 'HumanReviewId' };
export type CapabilityGapId = string & { readonly __brand: 'CapabilityGapId' };

export function asForgeRunId(id: string): ForgeRunId {
  return id as ForgeRunId;
}

export function asPackId(id: string): PackId {
  return id as PackId;
}

export function asPackVersionId(id: string): PackVersionId {
  return id as PackVersionId;
}

export function asStageExecutionId(id: string): StageExecutionId {
  return id as StageExecutionId;
}

export function asStageAttemptId(id: string): StageAttemptId {
  return id as StageAttemptId;
}

export function asArtifactId(id: string): ArtifactId {
  return id as ArtifactId;
}

export function asSourceId(id: string): SourceId {
  return id as SourceId;
}

export function asSourceSnapshotId(id: string): SourceSnapshotId {
  return id as SourceSnapshotId;
}

export function asEvidenceId(id: string): EvidenceId {
  return id as EvidenceId;
}

export function asCertificationId(id: string): CertificationId {
  return id as CertificationId;
}

export function asQualificationRecordId(id: string): QualificationRecordId {
  return id as QualificationRecordId;
}

export function asHumanReviewId(id: string): HumanReviewId {
  return id as HumanReviewId;
}

export function asCapabilityGapId(id: string): CapabilityGapId {
  return id as CapabilityGapId;
}
