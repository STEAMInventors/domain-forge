import type {
  ForgeRun,
  ForgeStageExecution,
  ForgeArtifact,
  PackVersion,
  CertificationRecord,
  SourceSnapshot,
  ValidationResult,
  FixtureExecutionRecord,
} from '@domain-forge/contracts';
import type { HumanGateRecord, BudgetUsage } from '@domain-forge/core';
import type { ForgeRepositories } from './repositories.js';
import type { ForgeRunRepository } from './repositories.js';
import type { StageExecutionRepository } from './repositories.js';
import type { ArtifactRepository } from './repositories.js';
import type { PackVersionRepository } from './repositories.js';
import type { CertificationRepository } from './repositories.js';
import type { SourceSnapshotRepository } from './repositories.js';
import type { HumanReviewRepository } from './repositories.js';
import type { ValidationResultRepository } from './repositories.js';
import type { FixtureExecutionRepository } from './repositories.js';
import type { BudgetUsageRepository } from './repositories.js';

function inMemoryStore<T extends { id?: string } | { sourceSnapshotId?: string }>(): {
  save(item: T): Promise<void>;
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
} {
  const map = new Map<string, T>();
  return {
    async save(item: T): Promise<void> {
      const id =
        'id' in item && item.id
          ? item.id
          : 'sourceSnapshotId' in item
            ? item.sourceSnapshotId
            : '';
      map.set(id as string, item);
    },
    async get(id: string): Promise<T | undefined> {
      return map.get(id);
    },
    async list(): Promise<T[]> {
      return [...map.values()];
    },
  };
}

export function createInMemoryRepositories(): ForgeRepositories {
  const runs = inMemoryStore<ForgeRun>();
  const stageExecutions = inMemoryStore<ForgeStageExecution>();
  const artifacts = inMemoryStore<ForgeArtifact>();
  const packVersions = inMemoryStore<PackVersion>();
  const certifications = inMemoryStore<CertificationRecord>();
  const snapshots = inMemoryStore<SourceSnapshot>();

  const humanReviewsMap = new Map<string, HumanGateRecord>();
  const validationMap = new Map<string, (ValidationResult & { id: string })[]>();
  const fixtureMap = new Map<string, FixtureExecutionRecord[]>();
  const budgetMap = new Map<string, BudgetUsage>();

  const forgeRuns: ForgeRunRepository = {
    save: (r) => runs.save(r),
    get: (id) => runs.get(id),
    list: () => runs.list(),
  };

  const stageExecutionsRepo: StageExecutionRepository = {
    save: (e) => stageExecutions.save(e),
    get: (id) => stageExecutions.get(id),
    listByRun: async (forgeRunId) =>
      (await stageExecutions.list()).filter((e) => e.forgeRunId === forgeRunId),
  };

  const artifactsRepo: ArtifactRepository = {
    save: (a) => artifacts.save(a),
    get: (id) => artifacts.get(id),
    listByRun: async (forgeRunId) =>
      (await artifacts.list()).filter((a) => a.forgeRunId === forgeRunId),
  };

  const packVersionsRepo: PackVersionRepository = {
    save: (v) => packVersions.save(v),
    get: (id) => packVersions.get(id),
    list: () => packVersions.list(),
  };

  const certificationsRepo: CertificationRepository = {
    save: (c) => certifications.save(c),
    get: (id) => certifications.get(id),
    listByPack: async (packId) =>
      (await certifications.list()).filter((c) => c.packId === packId),
  };

  const sourceSnapshotsRepo: SourceSnapshotRepository = {
    save: (s) => snapshots.save(s),
    get: (id) => snapshots.get(id),
  };

  const humanReviews: HumanReviewRepository = {
    save: async (r) => {
      humanReviewsMap.set(r.id, r);
    },
    get: async (id) => humanReviewsMap.get(id),
    listByRun: async (forgeRunId) =>
      [...humanReviewsMap.values()].filter((r) => r.forgeRunId === forgeRunId),
  };

  const validationResults: ValidationResultRepository = {
    save: async (result) => {
      const list = validationMap.get(result.forgeRunId) ?? [];
      list.push(result);
      validationMap.set(result.forgeRunId, list);
    },
    listByRun: async (forgeRunId) => validationMap.get(forgeRunId) ?? [],
  };

  const fixtureExecutions: FixtureExecutionRepository = {
    save: async (record) => {
      const list = fixtureMap.get(record.forgeRunId) ?? [];
      list.push(record);
      fixtureMap.set(record.forgeRunId, list);
    },
    listByRun: async (forgeRunId) => fixtureMap.get(forgeRunId) ?? [],
  };

  const budgetUsage: BudgetUsageRepository = {
    save: async (forgeRunId, usage) => {
      budgetMap.set(forgeRunId, usage);
    },
    get: async (forgeRunId) => budgetMap.get(forgeRunId),
  };

  return {
    forgeRuns,
    stageExecutions: stageExecutionsRepo,
    artifacts: artifactsRepo,
    packVersions: packVersionsRepo,
    certifications: certificationsRepo,
    sourceSnapshots: sourceSnapshotsRepo,
    humanReviews,
    validationResults,
    fixtureExecutions,
    budgetUsage,
  };
}
