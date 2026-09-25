import type {
  AcceptedEvidenceReference,
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
  PackVersionTransitionRecord,
  ForgeRunTransitionRecord,
  PackVersionTransitionAction,
  PackVersionTransitionContext,
  PackVersionState,
  ForgeRunTransitionAction,
  ForgeRunTransitionContext,
  ForgeRunState,
} from '@domain-forge/core';
import { ImmutableStore } from './immutable-store.js';
import {
  contentHashMismatch,
  duplicateImmutableRecord,
  immutableRecordModification,
  invalidPersistedLifecycleTransition,
  recordNotFound,
} from './persistence-errors.js';
import type { ForgeRepositories, PersistedFixtureCorpusReference } from './repositories.js';
import {
  validateCertificationRecord,
  validateDeserialized,
  validateForgeRun,
  validateForgeRunTransitionRecord,
  validatePackVersion,
  validatePackVersionTransitionRecord,
  validateQualificationRecord,
  validateSourceRecord,
  validateSourceSnapshot,
} from './record-validation.js';
import type { RuntimeEligibilityEvaluationRecord } from './runtime-eligibility-evaluation.js';
import {
  assertCertificationTransitionRecord,
  assertForgeRunExpectedState,
  assertPackVersionExpectedState,
  computeForgeRunTransition,
  computePackVersionTransition,
} from './lifecycle-helpers.js';
import { InMemoryTransactionScope, runAtomic, runCertificationAtomic } from './transaction-scope.js';

function recordsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface MutablePackVersionStore {
  readonly versions: ImmutableStore<PackVersion>;
  readonly transitions: ImmutableStore<PackVersionTransitionRecord>;
}

interface MutableForgeRunStore {
  readonly runs: ImmutableStore<ForgeRun>;
  readonly transitions: ImmutableStore<ForgeRunTransitionRecord>;
}

export function createInMemoryRepositories(): ForgeRepositories {
  const packVersionStore: MutablePackVersionStore = {
    versions: new ImmutableStore<PackVersion>({
      entity: 'PackVersion',
      getId: (v) => v.id,
      equals: recordsEqual,
    }),
    transitions: new ImmutableStore<PackVersionTransitionRecord>({
      entity: 'PackVersionTransitionRecord',
      getId: (r) => `${r.packVersionId}:${r.fromState}:${r.toState}:${r.action}`,
      equals: recordsEqual,
    }),
  };

  const forgeRunStore: MutableForgeRunStore = {
    runs: new ImmutableStore<ForgeRun>({
      entity: 'ForgeRun',
      getId: (r) => r.id,
      equals: recordsEqual,
    }),
    transitions: new ImmutableStore<ForgeRunTransitionRecord>({
      entity: 'ForgeRunTransitionRecord',
      getId: (r) => `${r.forgeRunId}:${r.fromState}:${r.toState}:${r.action}`,
      equals: recordsEqual,
    }),
  };

  const qualifications = new ImmutableStore<QualificationRecord>({
    entity: 'QualificationRecord',
    getId: (r) => r.id,
    equals: recordsEqual,
  });

  const certifications = new ImmutableStore<CertificationRecord>({
    entity: 'CertificationRecord',
    getId: (r) => r.id,
    equals: recordsEqual,
  });

  const sourceSnapshots = new ImmutableStore<SourceSnapshot>({
    entity: 'SourceSnapshot',
    getId: (s) => s.sourceSnapshotId,
    equals: recordsEqual,
  });

  const sourceRecords = new ImmutableStore<SourceRecord>({
    entity: 'SourceRecord',
    getId: (r) => r.identity.sourceId,
    equals: recordsEqual,
  });

  const acceptedEvidence = new ImmutableStore<AcceptedEvidenceReference>({
    entity: 'AcceptedEvidenceReference',
    getId: (r) => r.evidenceId,
    equals: recordsEqual,
  });

  const proposedEvidenceStore: (ProposedEvidenceReference & { recordedAt: string })[] = [];

  const stageExecutions = new ImmutableStore<ForgeStageExecution>({
    entity: 'ForgeStageExecution',
    getId: (e) => e.id,
    equals: recordsEqual,
  });

  const artifacts = new ImmutableStore<ForgeArtifact>({
    entity: 'ForgeArtifact',
    getId: (a) => a.id,
    equals: recordsEqual,
  });

  const proposedArtifacts: Array<{
    forgeRunId: ForgeRunId;
    stageId: string;
    attemptNumber: number;
    rawResponseHash: string;
    rawText: string;
    recordedAt: string;
  }> = [];

  const fixtureCorpusReferences = new ImmutableStore<PersistedFixtureCorpusReference>({
    entity: 'PersistedFixtureCorpusReference',
    getId: (r) => r.fixtureCorpusHash,
    equals: recordsEqual,
  });

  const runtimeEligibilityEvaluations: RuntimeEligibilityEvaluationRecord[] = [];

  const humanReviews = new ImmutableStore<HumanGateRecord>({
    entity: 'HumanGateRecord',
    getId: (r) => r.id,
    equals: recordsEqual,
  });

  const validationResults = new Map<string, (ValidationResult & { id: string })[]>();
  const fixtureExecutions = new Map<string, FixtureExecutionRecord[]>();
  const budgetMap = new Map<string, BudgetUsage>();

  const packVersions = {
    async insert(version: PackVersion): Promise<void> {
      const validated = validatePackVersion(version);
      const existing = packVersionStore.versions.get(validated.id);
      if (existing !== undefined) {
        if (recordsEqual(existing, validated)) {
          return;
        }
        throw duplicateImmutableRecord('PackVersion', validated.id);
      }
      packVersionStore.versions.append(validated);
    },
    async get(id: PackVersionId): Promise<PackVersion | undefined> {
      return packVersionStore.versions.get(id);
    },
    async getByIdentity(query: { packId: PackId; version: string }): Promise<PackVersion | undefined> {
      return packVersionStore.versions
        .list()
        .find((v) => v.packId === query.packId && v.version === query.version);
    },
    async getByContentHash(query: {
      packId: PackId;
      packContentHash: string;
    }): Promise<PackVersion | undefined> {
      return packVersionStore.versions
        .list()
        .find((v) => v.packId === query.packId && v.packContentHash === query.packContentHash);
    },
    async list(): Promise<PackVersion[]> {
      return [...packVersionStore.versions.list()];
    },
    async listByPack(packId: PackId): Promise<PackVersion[]> {
      return packVersionStore.versions.list().filter((v) => v.packId === packId);
    },
    async save(version: PackVersion): Promise<void> {
      const existing = packVersionStore.versions.get(version.id);
      if (existing === undefined) {
        await packVersions.insert(version);
        return;
      }
      if (recordsEqual(existing, version)) {
        return;
      }
      if (existing.state !== version.state) {
        throw immutableRecordModification('PackVersion', version.id, {
          reason: 'Use packVersionLifecycle.applyTransition for state changes',
        });
      }
      if (existing.packContentHash !== version.packContentHash) {
        throw immutableRecordModification('PackVersion', version.id, {
          reason: 'Pack content is immutable; create a new PackVersion',
        });
      }
      throw immutableRecordModification('PackVersion', version.id);
    },
  };

  const packVersionLifecycle = {
    async applyTransition(input: {
      packVersionId: PackVersionId;
      action: PackVersionTransitionAction;
      expectedFromState: PackVersionState;
      context?: PackVersionTransitionContext;
    }) {
      const existing = packVersionStore.versions.get(input.packVersionId);
      if (existing === undefined) {
        throw recordNotFound('PackVersion', input.packVersionId);
      }
      assertPackVersionExpectedState(existing.state, input.expectedFromState, input.packVersionId);

      const scope = new InMemoryTransactionScope();
      scope.track({
        restore: () => packVersionStore.versions.restore(packVersionStore.versions.snapshot()),
      });
      scope.track({
        restore: () => packVersionStore.transitions.restore(packVersionStore.transitions.snapshot()),
      });

      return runAtomic(scope, async () => {
        const { packVersion, record } = computePackVersionTransition(
          existing,
          input.action,
          input.context,
        );
        validatePackVersionTransitionRecord(record);
        packVersionStore.transitions.append(record);
        packVersionStore.versions.replace(input.packVersionId, packVersion, () => true);
        return { packVersion, record };
      });
    },
  };

  const packVersionTransitions = {
    async append(record: PackVersionTransitionRecord): Promise<void> {
      packVersionStore.transitions.append(validatePackVersionTransitionRecord(record));
    },
    async listByPackVersion(packVersionId: PackVersionId) {
      return packVersionStore.transitions
        .list()
        .filter((r) => r.packVersionId === packVersionId);
    },
  };

  const forgeRuns = {
    async insert(run: ForgeRun): Promise<void> {
      forgeRunStore.runs.append(validateForgeRun(run));
    },
    async get(id: ForgeRunId): Promise<ForgeRun | undefined> {
      return forgeRunStore.runs.get(id);
    },
    async list(): Promise<ForgeRun[]> {
      return [...forgeRunStore.runs.list()];
    },
    async listByPackVersion(packVersionId: PackVersionId): Promise<ForgeRun[]> {
      return forgeRunStore.runs.list().filter((r) => r.packVersionId === packVersionId);
    },
    async save(run: ForgeRun): Promise<void> {
      const existing = forgeRunStore.runs.get(run.id);
      if (existing === undefined) {
        await forgeRuns.insert(run);
        return;
      }
      if (recordsEqual(existing, run)) {
        return;
      }
      if (existing.state !== run.state) {
        throw immutableRecordModification('ForgeRun', run.id, {
          reason: 'Use forgeRunLifecycle.applyTransition for state changes',
        });
      }
      throw immutableRecordModification('ForgeRun', run.id);
    },
  };

  const forgeRunLifecycle = {
    async applyTransition(input: {
      forgeRunId: ForgeRunId;
      action: ForgeRunTransitionAction;
      expectedFromState: ForgeRunState;
      context?: ForgeRunTransitionContext;
    }) {
      const existing = forgeRunStore.runs.get(input.forgeRunId);
      if (existing === undefined) {
        throw recordNotFound('ForgeRun', input.forgeRunId);
      }
      assertForgeRunExpectedState(existing.state, input.expectedFromState, input.forgeRunId);

      const scope = new InMemoryTransactionScope();
      scope.track({ restore: () => forgeRunStore.runs.restore(forgeRunStore.runs.snapshot()) });
      scope.track({
        restore: () => forgeRunStore.transitions.restore(forgeRunStore.transitions.snapshot()),
      });

      return runAtomic(scope, async () => {
        const { run, record } = computeForgeRunTransition(existing, input.action, input.context);
        validateForgeRunTransitionRecord(record);
        forgeRunStore.transitions.append(record);
        forgeRunStore.runs.replace(input.forgeRunId, run, () => true);
        return { run, record };
      });
    },
  };

  const forgeRunTransitions = {
    async append(record: ForgeRunTransitionRecord): Promise<void> {
      forgeRunStore.transitions.append(validateForgeRunTransitionRecord(record));
    },
    async listByRun(forgeRunId: ForgeRunId) {
      return forgeRunStore.transitions.list().filter((r) => r.forgeRunId === forgeRunId);
    },
  };

  const qualificationRepo = {
    async append(record: QualificationRecord): Promise<void> {
      qualifications.append(validateQualificationRecord(record));
    },
    async get(id: QualificationRecordId): Promise<QualificationRecord | undefined> {
      return qualifications.get(id);
    },
    async listByPack(packId: PackId): Promise<QualificationRecord[]> {
      return qualifications.list().filter((r) => r.identity.packId === packId);
    },
    async findByPackContentHash(packId: PackId, packContentHash: string): Promise<QualificationRecord[]> {
      return qualifications
        .list()
        .filter((r) => r.identity.packId === packId && r.identity.packContentHash === packContentHash);
    },
  };

  const certificationRepo = {
    async append(record: CertificationRecord): Promise<void> {
      certifications.append(validateCertificationRecord(record));
    },
    async get(id: CertificationId): Promise<CertificationRecord | undefined> {
      return certifications.get(id);
    },
    async listByPack(packId: PackId): Promise<CertificationRecord[]> {
      return certifications.list().filter((r) => r.packId === packId);
    },
    async findByPackContentHash(
      packId: PackId,
      packContentHash: string,
    ): Promise<CertificationRecord[]> {
      return certifications
        .list()
        .filter((r) => r.packId === packId && r.packContentHash === packContentHash);
    },
    async save(record: CertificationRecord): Promise<void> {
      await certificationRepo.append(record);
    },
  };

  const certificationTransactions = {
    async persistCertificationWithTransition(input: {
      certification: CertificationRecord;
      packVersion: PackVersion;
      transitionRecord: PackVersionTransitionRecord;
      expectedFromState: PackVersionState;
    }): Promise<void> {
      const certification = validateCertificationRecord(input.certification);
      const packVersion = validatePackVersion(input.packVersion);
      const transitionRecord = validatePackVersionTransitionRecord(input.transitionRecord);

      if (certification.packContentHash !== packVersion.packContentHash) {
        throw contentHashMismatch(
          'CertificationRecord/PackVersion',
          certification.packContentHash,
          packVersion.packContentHash,
        );
      }

      if (certification.decision.kind !== 'certified') {
        throw immutableRecordModification('CertificationRecord', certification.id, {
          reason: 'Only certified decisions may atomically transition PackVersion to CERTIFIED',
        });
      }

      assertCertificationTransitionRecord(transitionRecord, input.expectedFromState);

      const existing = packVersionStore.versions.get(packVersion.id);
      if (existing === undefined) {
        throw recordNotFound('PackVersion', packVersion.id);
      }
      assertPackVersionExpectedState(existing.state, input.expectedFromState, packVersion.id);

      if (packVersion.state !== 'CERTIFIED') {
        throw invalidPersistedLifecycleTransition('Certification persistence requires CERTIFIED PackVersion state', {
          actualState: packVersion.state,
        });
      }

      if (
        transitionRecord.packVersionId !== packVersion.id ||
        transitionRecord.packContentHash !== packVersion.packContentHash ||
        transitionRecord.fromState !== input.expectedFromState ||
        transitionRecord.toState !== 'CERTIFIED' ||
        transitionRecord.action !== 'CERTIFY'
      ) {
        throw contentHashMismatch('CertificationRecord/PackVersionTransitionRecord', 'expected', 'supplied');
      }

      const computed = computePackVersionTransition(existing, 'CERTIFY', {
        actorRef: certification.reviewerId,
        reasonRef: certification.id,
      });

      const scope = new InMemoryTransactionScope();
      scope.track({
        restore: () => packVersionStore.versions.restore(packVersionStore.versions.snapshot()),
      });
      scope.track({
        restore: () => packVersionStore.transitions.restore(packVersionStore.transitions.snapshot()),
      });
      scope.track({
        restore: () => certifications.restore(certifications.snapshot()),
      });

      await runCertificationAtomic(scope, async () => {
        certifications.append(certification);
        packVersionStore.transitions.append(computed.record);
        packVersionStore.versions.replace(packVersion.id, computed.packVersion, () => true);
      });
    },
  };

  const sourceSnapshotsRepo = {
    async append(snapshot: SourceSnapshot): Promise<void> {
      sourceSnapshots.append(validateSourceSnapshot(snapshot));
    },
    async get(id: SourceSnapshotId): Promise<SourceSnapshot | undefined> {
      return sourceSnapshots.get(id);
    },
    async getByContentHash(contentHash: string): Promise<SourceSnapshot | undefined> {
      return sourceSnapshots.list().find((s) => s.contentHash === contentHash);
    },
    async save(snapshot: SourceSnapshot): Promise<void> {
      await sourceSnapshotsRepo.append(snapshot);
    },
  };

  const sourceRecordsRepo = {
    async save(record: SourceRecord): Promise<void> {
      const validated = validateSourceRecord(record);
      const existing = sourceRecords.get(validated.identity.sourceId);
      if (existing !== undefined && !recordsEqual(existing, validated)) {
        throw immutableRecordModification('SourceRecord', validated.identity.sourceId);
      }
      if (existing === undefined) {
        sourceRecords.append(validated);
      }
    },
    async get(sourceId: SourceId): Promise<SourceRecord | undefined> {
      return sourceRecords.get(sourceId);
    },
    async getByFingerprint(fingerprint: string): Promise<SourceRecord | undefined> {
      return sourceRecords
        .list()
        .find((r) => r.identity.contentFingerprint.hash === fingerprint);
    },
  };

  const acceptedEvidenceRepo = {
    async append(reference: AcceptedEvidenceReference): Promise<void> {
      if (reference.source !== 'VALIDATED') {
        throw immutableRecordModification('AcceptedEvidenceReference', reference.evidenceId, {
          reason: 'Only VALIDATED evidence may be persisted as accepted evidence',
        });
      }
      acceptedEvidence.append(reference);
    },
    async get(evidenceId: EvidenceId): Promise<AcceptedEvidenceReference | undefined> {
      return acceptedEvidence.get(evidenceId);
    },
    async listBySource(sourceId: SourceId): Promise<AcceptedEvidenceReference[]> {
      return acceptedEvidence.list().filter((r) => r.sourceId === sourceId);
    },
  };

  const proposedEvidenceRepo = {
    async append(reference: ProposedEvidenceReference & { recordedAt: string }): Promise<void> {
      proposedEvidenceStore.push({ ...reference });
    },
    async listBySource(sourceId: SourceId) {
      return proposedEvidenceStore.filter((r) => r.sourceId === sourceId);
    },
  };

  const stageExecutionsRepo = {
    async append(execution: ForgeStageExecution): Promise<void> {
      stageExecutions.append(execution);
    },
    async get(id: StageExecutionId): Promise<ForgeStageExecution | undefined> {
      return stageExecutions.get(id);
    },
    async listByRun(forgeRunId: ForgeRunId): Promise<ForgeStageExecution[]> {
      return stageExecutions.list().filter((e) => e.forgeRunId === forgeRunId);
    },
    async save(execution: ForgeStageExecution): Promise<void> {
      await stageExecutionsRepo.append(execution);
    },
  };

  const artifactsRepo = {
    async append(artifact: ForgeArtifact): Promise<void> {
      if (!artifact.immutable) {
        throw immutableRecordModification('ForgeArtifact', artifact.id, {
          reason: 'Only immutable accepted artifacts may be persisted in the artifact repository',
        });
      }
      artifacts.append(artifact);
    },
    async get(id: ArtifactId): Promise<ForgeArtifact | undefined> {
      return artifacts.get(id);
    },
    async listByRun(forgeRunId: ForgeRunId): Promise<ForgeArtifact[]> {
      return artifacts.list().filter((a) => a.forgeRunId === forgeRunId);
    },
    async save(artifact: ForgeArtifact): Promise<void> {
      await artifactsRepo.append(artifact);
    },
  };

  const proposedArtifactsRepo = {
    async append(input: {
      forgeRunId: ForgeRunId;
      stageId: string;
      attemptNumber: number;
      rawResponseHash: string;
      rawText: string;
      recordedAt: string;
    }): Promise<void> {
      proposedArtifacts.push({ ...input });
    },
    async listByRun(forgeRunId: ForgeRunId) {
      return proposedArtifacts.filter((a) => a.forgeRunId === forgeRunId);
    },
  };

  const fixtureCorpusReferencesRepo = {
    async append(reference: PersistedFixtureCorpusReference): Promise<void> {
      fixtureCorpusReferences.append(reference);
    },
    async getByHash(fixtureCorpusHash: string): Promise<PersistedFixtureCorpusReference | undefined> {
      return fixtureCorpusReferences.get(fixtureCorpusHash);
    },
  };

  const runtimeEligibilityEvaluationsRepo = {
    async append(record: RuntimeEligibilityEvaluationRecord): Promise<void> {
      runtimeEligibilityEvaluations.push({ ...record });
    },
    async listByPackVersion(packVersionId: PackVersionId): Promise<RuntimeEligibilityEvaluationRecord[]> {
      return runtimeEligibilityEvaluations.filter((r) => r.packVersionId === packVersionId);
    },
  };

  const humanReviewsRepo = {
    async append(record: HumanGateRecord): Promise<void> {
      humanReviews.append(record);
    },
    async get(id: HumanReviewId): Promise<HumanGateRecord | undefined> {
      return humanReviews.get(id);
    },
    async listByRun(forgeRunId: ForgeRunId): Promise<HumanGateRecord[]> {
      return humanReviews.list().filter((r) => r.forgeRunId === forgeRunId);
    },
    async save(record: HumanGateRecord): Promise<void> {
      await humanReviewsRepo.append(record);
    },
  };

  const validationResultsRepo = {
    async append(result: ValidationResult & { id: string; forgeRunId: ForgeRunId }): Promise<void> {
      const list = validationResults.get(result.forgeRunId) ?? [];
      list.push(result);
      validationResults.set(result.forgeRunId, list);
    },
    async listByRun(forgeRunId: ForgeRunId): Promise<(ValidationResult & { id: string })[]> {
      return validationResults.get(forgeRunId) ?? [];
    },
    async save(result: ValidationResult & { id: string; forgeRunId: ForgeRunId }): Promise<void> {
      await validationResultsRepo.append(result);
    },
  };

  const fixtureExecutionsRepo = {
    async append(record: FixtureExecutionRecord & { forgeRunId: ForgeRunId }): Promise<void> {
      const list = fixtureExecutions.get(record.forgeRunId) ?? [];
      list.push(record);
      fixtureExecutions.set(record.forgeRunId, list);
    },
    async listByRun(forgeRunId: ForgeRunId): Promise<FixtureExecutionRecord[]> {
      return fixtureExecutions.get(forgeRunId) ?? [];
    },
    async save(record: FixtureExecutionRecord & { forgeRunId: ForgeRunId }): Promise<void> {
      await fixtureExecutionsRepo.append(record);
    },
  };

  const budgetUsageRepo = {
    async save(forgeRunId: ForgeRunId, usage: BudgetUsage): Promise<void> {
      budgetMap.set(forgeRunId, usage);
    },
    async get(forgeRunId: ForgeRunId): Promise<BudgetUsage | undefined> {
      return budgetMap.get(forgeRunId);
    },
  };

  return {
    forgeRuns,
    forgeRunLifecycle,
    forgeRunTransitions,
    stageExecutions: stageExecutionsRepo,
    artifacts: artifactsRepo,
    proposedArtifacts: proposedArtifactsRepo,
    packVersions,
    packVersionLifecycle,
    packVersionTransitions,
    qualifications: qualificationRepo,
    certifications: certificationRepo,
    certificationTransactions,
    sourceSnapshots: sourceSnapshotsRepo,
    sourceRecords: sourceRecordsRepo,
    acceptedEvidence: acceptedEvidenceRepo,
    proposedEvidence: proposedEvidenceRepo,
    fixtureCorpusReferences: fixtureCorpusReferencesRepo,
    runtimeEligibilityEvaluations: runtimeEligibilityEvaluationsRepo,
    humanReviews: humanReviewsRepo,
    validationResults: validationResultsRepo,
    fixtureExecutions: fixtureExecutionsRepo,
    budgetUsage: budgetUsageRepo,
  };
}

/** Validate deserialized records loaded from JSON-file persistence. */
export function hydratePersistedRecord<T>(
  entity: string,
  value: unknown,
  validator: (record: T) => T,
): T {
  return validateDeserialized(entity, value, validator);
}
