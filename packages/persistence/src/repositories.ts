import type {
  ForgeRun,
  ForgeStageExecution,
  ForgeArtifact,
  PackVersion,
  CertificationRecord,
  SourceSnapshot,
  FixtureExecutionRecord,
} from '@domain-forge/contracts';
import type { HumanGateRecord, BudgetUsage } from '@domain-forge/core';
import type {
  ForgeRunId,
  StageExecutionId,
  ArtifactId,
  PackVersionId,
  CertificationId,
  SourceSnapshotId,
  HumanReviewId,
} from '@domain-forge/core';
import type { ValidationResult } from '@domain-forge/contracts';

export interface ForgeRunRepository {
  save(run: ForgeRun): Promise<void>;
  get(id: ForgeRunId): Promise<ForgeRun | undefined>;
  list(): Promise<ForgeRun[]>;
}

export interface StageExecutionRepository {
  save(execution: ForgeStageExecution): Promise<void>;
  get(id: StageExecutionId): Promise<ForgeStageExecution | undefined>;
  listByRun(forgeRunId: ForgeRunId): Promise<ForgeStageExecution[]>;
}

export interface ArtifactRepository {
  save(artifact: ForgeArtifact): Promise<void>;
  get(id: ArtifactId): Promise<ForgeArtifact | undefined>;
  listByRun(forgeRunId: ForgeRunId): Promise<ForgeArtifact[]>;
}

export interface PackVersionRepository {
  save(version: PackVersion): Promise<void>;
  get(id: PackVersionId): Promise<PackVersion | undefined>;
  list(): Promise<PackVersion[]>;
}

export interface CertificationRepository {
  save(record: CertificationRecord): Promise<void>;
  get(id: CertificationId): Promise<CertificationRecord | undefined>;
  listByPack(packId: string): Promise<CertificationRecord[]>;
}

export interface SourceSnapshotRepository {
  save(snapshot: SourceSnapshot): Promise<void>;
  get(id: SourceSnapshotId): Promise<SourceSnapshot | undefined>;
}

export interface HumanReviewRepository {
  save(record: HumanGateRecord): Promise<void>;
  get(id: HumanReviewId): Promise<HumanGateRecord | undefined>;
  listByRun(forgeRunId: ForgeRunId): Promise<HumanGateRecord[]>;
}

export interface ValidationResultRepository {
  save(result: ValidationResult & { id: string; forgeRunId: ForgeRunId }): Promise<void>;
  listByRun(forgeRunId: ForgeRunId): Promise<(ValidationResult & { id: string })[]>;
}

export interface FixtureExecutionRepository {
  save(record: FixtureExecutionRecord & { forgeRunId: ForgeRunId }): Promise<void>;
  listByRun(forgeRunId: ForgeRunId): Promise<FixtureExecutionRecord[]>;
}

export interface BudgetUsageRepository {
  save(forgeRunId: ForgeRunId, usage: BudgetUsage): Promise<void>;
  get(forgeRunId: ForgeRunId): Promise<BudgetUsage | undefined>;
}

export interface ForgeRepositories {
  forgeRuns: ForgeRunRepository;
  stageExecutions: StageExecutionRepository;
  artifacts: ArtifactRepository;
  packVersions: PackVersionRepository;
  certifications: CertificationRepository;
  sourceSnapshots: SourceSnapshotRepository;
  humanReviews: HumanReviewRepository;
  validationResults: ValidationResultRepository;
  fixtureExecutions: FixtureExecutionRepository;
  budgetUsage: BudgetUsageRepository;
}
