import type {
  AcceptedEvidenceReference,
  AcceptedFixtureCorpus,
  CertificationRecord,
  ForgeArtifact,
  ForgeRun,
  ForgeStageExecution,
  PackVersion,
  ProposedEvidenceReference,
  QualificationRecord,
  SourceRecord,
  SourceSnapshot,
  ValidationResult,
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
  QualificationRecordId,
  SourceId,
  EvidenceId,
  PackId,
  ForgeRunTransitionRecord,
  PackVersionTransitionRecord,
  PackVersionTransitionAction,
  PackVersionTransitionContext,
  PackVersionState,
  ForgeRunTransitionAction,
  ForgeRunTransitionContext,
  ForgeRunState,
} from '@domain-forge/core';
import type { RuntimeEligibilityEvaluationRecord } from './runtime-eligibility-evaluation.js';

export interface PackVersionIdentityQuery {
  readonly packId: PackId;
  readonly version: string;
}

export interface PackVersionHashQuery {
  readonly packId: PackId;
  readonly packContentHash: string;
}

export interface ForgeRunRepository {
  insert(run: ForgeRun): Promise<void>;
  get(id: ForgeRunId): Promise<ForgeRun | undefined>;
  list(): Promise<ForgeRun[]>;
  listByPackVersion(packVersionId: PackVersionId): Promise<ForgeRun[]>;
  /** @deprecated Use insert for new runs; lifecycle changes use applyTransition */
  save(run: ForgeRun): Promise<void>;
}

export interface ForgeRunLifecycleRepository {
  applyTransition(input: {
    forgeRunId: ForgeRunId;
    action: ForgeRunTransitionAction;
    expectedFromState: ForgeRunState;
    context?: ForgeRunTransitionContext;
  }): Promise<{ run: ForgeRun; record: ForgeRunTransitionRecord }>;
}

export interface ForgeRunTransitionRepository {
  append(record: ForgeRunTransitionRecord): Promise<void>;
  listByRun(forgeRunId: ForgeRunId): Promise<ForgeRunTransitionRecord[]>;
}

export interface StageExecutionRepository {
  append(execution: ForgeStageExecution): Promise<void>;
  get(id: StageExecutionId): Promise<ForgeStageExecution | undefined>;
  listByRun(forgeRunId: ForgeRunId): Promise<ForgeStageExecution[]>;
  /** @deprecated Use append for immutable stage executions */
  save(execution: ForgeStageExecution): Promise<void>;
}

export interface ArtifactRepository {
  append(artifact: ForgeArtifact): Promise<void>;
  get(id: ArtifactId): Promise<ForgeArtifact | undefined>;
  listByRun(forgeRunId: ForgeRunId): Promise<ForgeArtifact[]>;
  /** @deprecated Use append for accepted immutable artifacts */
  save(artifact: ForgeArtifact): Promise<void>;
}

export interface ProposedArtifactRepository {
  append(input: {
    forgeRunId: ForgeRunId;
    stageId: string;
    attemptNumber: number;
    rawResponseHash: string;
    rawText: string;
    recordedAt: string;
  }): Promise<void>;
  listByRun(forgeRunId: ForgeRunId): Promise<
    readonly {
      forgeRunId: ForgeRunId;
      stageId: string;
      attemptNumber: number;
      rawResponseHash: string;
      rawText: string;
      recordedAt: string;
    }[]
  >;
}

export interface PackVersionRepository {
  insert(version: PackVersion): Promise<void>;
  get(id: PackVersionId): Promise<PackVersion | undefined>;
  getByIdentity(query: PackVersionIdentityQuery): Promise<PackVersion | undefined>;
  getByContentHash(query: PackVersionHashQuery): Promise<PackVersion | undefined>;
  list(): Promise<PackVersion[]>;
  listByPack(packId: PackId): Promise<PackVersion[]>;
  /** @deprecated Use insert for new versions; lifecycle changes use applyTransition */
  save(version: PackVersion): Promise<void>;
}

export interface PackVersionLifecycleRepository {
  applyTransition(input: {
    packVersionId: PackVersionId;
    action: PackVersionTransitionAction;
    expectedFromState: PackVersionState;
    context?: PackVersionTransitionContext;
  }): Promise<{ packVersion: PackVersion; record: PackVersionTransitionRecord }>;
}

export interface PackVersionTransitionRepository {
  append(record: PackVersionTransitionRecord): Promise<void>;
  listByPackVersion(packVersionId: PackVersionId): Promise<PackVersionTransitionRecord[]>;
}

export interface QualificationRepository {
  append(record: QualificationRecord): Promise<void>;
  get(id: QualificationRecordId): Promise<QualificationRecord | undefined>;
  listByPack(packId: PackId): Promise<QualificationRecord[]>;
  findByPackContentHash(
    packId: PackId,
    packContentHash: string,
  ): Promise<QualificationRecord[]>;
}

export interface CertificationRepository {
  append(record: CertificationRecord): Promise<void>;
  get(id: CertificationId): Promise<CertificationRecord | undefined>;
  listByPack(packId: PackId): Promise<CertificationRecord[]>;
  findByPackContentHash(
    packId: PackId,
    packContentHash: string,
  ): Promise<CertificationRecord[]>;
  /** @deprecated Use append for immutable certification records */
  save(record: CertificationRecord): Promise<void>;
}

export interface CertificationPersistenceTransaction {
  persistCertificationWithTransition(input: {
    certification: CertificationRecord;
    packVersion: PackVersion;
    transitionRecord: PackVersionTransitionRecord;
    expectedFromState: PackVersionState;
  }): Promise<void>;
}

export interface SourceSnapshotRepository {
  append(snapshot: SourceSnapshot): Promise<void>;
  get(id: SourceSnapshotId): Promise<SourceSnapshot | undefined>;
  getByContentHash(contentHash: string): Promise<SourceSnapshot | undefined>;
  /** @deprecated Use append for immutable snapshots */
  save(snapshot: SourceSnapshot): Promise<void>;
}

export interface SourceRecordRepository {
  save(record: SourceRecord): Promise<void>;
  get(sourceId: SourceId): Promise<SourceRecord | undefined>;
  getByFingerprint(fingerprint: string): Promise<SourceRecord | undefined>;
}

export interface AcceptedEvidenceRepository {
  append(reference: AcceptedEvidenceReference): Promise<void>;
  get(evidenceId: EvidenceId): Promise<AcceptedEvidenceReference | undefined>;
  listBySource(sourceId: SourceId): Promise<AcceptedEvidenceReference[]>;
}

export interface ProposedEvidenceRepository {
  append(reference: ProposedEvidenceReference & { recordedAt: string }): Promise<void>;
  listBySource(sourceId: SourceId): Promise<(ProposedEvidenceReference & { recordedAt: string })[]>;
}

export interface PersistedFixtureCorpusReference {
  readonly fixtureCorpusHash: string;
  readonly corpus: AcceptedFixtureCorpus;
  readonly persistedAt: string;
}

export interface FixtureCorpusReferenceRepository {
  append(reference: PersistedFixtureCorpusReference): Promise<void>;
  getByHash(fixtureCorpusHash: string): Promise<PersistedFixtureCorpusReference | undefined>;
}

export interface RuntimeEligibilityEvaluationRepository {
  append(record: RuntimeEligibilityEvaluationRecord): Promise<void>;
  listByPackVersion(packVersionId: PackVersionId): Promise<RuntimeEligibilityEvaluationRecord[]>;
}

export interface HumanReviewRepository {
  append(record: HumanGateRecord): Promise<void>;
  get(id: HumanReviewId): Promise<HumanGateRecord | undefined>;
  listByRun(forgeRunId: ForgeRunId): Promise<HumanGateRecord[]>;
  /** @deprecated Use append for review records */
  save(record: HumanGateRecord): Promise<void>;
}

export interface ValidationResultRepository {
  append(result: ValidationResult & { id: string; forgeRunId: ForgeRunId }): Promise<void>;
  listByRun(forgeRunId: ForgeRunId): Promise<(ValidationResult & { id: string })[]>;
  /** @deprecated Use append */
  save(result: ValidationResult & { id: string; forgeRunId: ForgeRunId }): Promise<void>;
}

export interface FixtureExecutionRepository {
  append(record: FixtureExecutionRecord & { forgeRunId: ForgeRunId }): Promise<void>;
  listByRun(forgeRunId: ForgeRunId): Promise<FixtureExecutionRecord[]>;
  /** @deprecated Use append */
  save(record: FixtureExecutionRecord & { forgeRunId: ForgeRunId }): Promise<void>;
}

export interface BudgetUsageRepository {
  save(forgeRunId: ForgeRunId, usage: BudgetUsage): Promise<void>;
  get(forgeRunId: ForgeRunId): Promise<BudgetUsage | undefined>;
}

export interface ForgeRepositories {
  forgeRuns: ForgeRunRepository;
  forgeRunLifecycle: ForgeRunLifecycleRepository;
  forgeRunTransitions: ForgeRunTransitionRepository;
  stageExecutions: StageExecutionRepository;
  artifacts: ArtifactRepository;
  proposedArtifacts: ProposedArtifactRepository;
  packVersions: PackVersionRepository;
  packVersionLifecycle: PackVersionLifecycleRepository;
  packVersionTransitions: PackVersionTransitionRepository;
  qualifications: QualificationRepository;
  certifications: CertificationRepository;
  certificationTransactions: CertificationPersistenceTransaction;
  sourceSnapshots: SourceSnapshotRepository;
  sourceRecords: SourceRecordRepository;
  acceptedEvidence: AcceptedEvidenceRepository;
  proposedEvidence: ProposedEvidenceRepository;
  fixtureCorpusReferences: FixtureCorpusReferenceRepository;
  runtimeEligibilityEvaluations: RuntimeEligibilityEvaluationRepository;
  humanReviews: HumanReviewRepository;
  validationResults: ValidationResultRepository;
  fixtureExecutions: FixtureExecutionRepository;
  budgetUsage: BudgetUsageRepository;
}
