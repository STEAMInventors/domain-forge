import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AcceptedEvidenceReference,
  CertificationRecord,
  ForgeArtifact,
  ForgeRun,
  ForgeStageExecution,
  PackVersion,
  QualificationRecord,
} from '@domain-forge/contracts';
import type { HumanGateRecord } from '@domain-forge/core';
import type {
  ForgeRunTransitionRecord,
  PackVersionTransitionRecord,
} from '@domain-forge/core';
import type { ForgeRepositories } from './repositories.js';
import type { PersistedFixtureCorpusReference } from './repositories.js';
import { createInMemoryRepositories, hydratePersistedRecord } from './in-memory.js';
import {
  validateCertificationRecord,
  validateForgeRun,
  validateForgeRunTransitionRecord,
  validatePackVersion,
  validatePackVersionTransitionRecord,
  validateQualificationRecord,
  validateSourceRecord,
  validateSourceSnapshot,
} from './record-validation.js';
import type { RuntimeEligibilityEvaluationRecord } from './runtime-eligibility-evaluation.js';

export interface JsonFilePersistenceOptions {
  baseDir: string;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

/** JSON-file persistence adapter — loads on init, writes through to disk on mutation. */
export class JsonFilePersistence {
  private readonly baseDir: string;
  private readonly repos: ForgeRepositories;
  private loaded = false;

  constructor(options: JsonFilePersistenceOptions) {
    this.baseDir = options.baseDir;
    this.repos = createInMemoryRepositories();
    this.wrapRepositoriesForDisk();
  }

  get repositories(): ForgeRepositories {
    return this.repos;
  }

  private collectionPath(name: string): string {
    return join(this.baseDir, name);
  }

  private async ensureCollections(): Promise<void> {
    const collections = [
      'forge_runs',
      'forge_run_transitions',
      'stage_executions',
      'artifacts',
      'proposed_artifacts',
      'pack_versions',
      'pack_version_transitions',
      'qualifications',
      'certifications',
      'sources',
      'source_records',
      'accepted_evidence',
      'proposed_evidence',
      'fixture_corpus_references',
      'runtime_eligibility_evaluations',
      'human_reviews',
      'validation_results',
      'fixture_executions',
      'budget_usage',
    ];
    await mkdir(this.baseDir, { recursive: true });
    for (const col of collections) {
      await mkdir(this.collectionPath(col), { recursive: true });
    }
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    await this.ensureCollections();

    await this.loadCollection('forge_runs', (item) =>
      this.repos.forgeRuns.insert(hydratePersistedRecord('ForgeRun', item, validateForgeRun)),
    );
    await this.loadCollection('forge_run_transitions', (item) =>
      this.repos.forgeRunTransitions.append(
        hydratePersistedRecord('ForgeRunTransitionRecord', item, validateForgeRunTransitionRecord),
      ),
    );
    await this.loadCollection('stage_executions', (item) =>
      this.repos.stageExecutions.append(item as ForgeStageExecution),
    );
    await this.loadCollection('artifacts', (item) =>
      this.repos.artifacts.append(item as ForgeArtifact),
    );
    await this.loadCollection('pack_versions', (item) =>
      this.repos.packVersions.insert(
        hydratePersistedRecord('PackVersion', item, validatePackVersion),
      ),
    );
    await this.loadCollection('pack_version_transitions', (item) =>
      this.repos.packVersionTransitions.append(
        hydratePersistedRecord('PackVersionTransitionRecord', item, validatePackVersionTransitionRecord),
      ),
    );
    await this.loadCollection('qualifications', (item) =>
      this.repos.qualifications.append(
        hydratePersistedRecord('QualificationRecord', item, validateQualificationRecord),
      ),
    );
    await this.loadCollection('certifications', (item) =>
      this.repos.certifications.append(
        hydratePersistedRecord('CertificationRecord', item, validateCertificationRecord),
      ),
    );
    await this.loadCollection('sources', (item) =>
      this.repos.sourceSnapshots.append(
        hydratePersistedRecord('SourceSnapshot', item, validateSourceSnapshot),
      ),
    );
    await this.loadCollection('source_records', (item) =>
      this.repos.sourceRecords.save(
        hydratePersistedRecord('SourceRecord', item, validateSourceRecord),
      ),
    );
    await this.loadCollection('accepted_evidence', (item) =>
      this.repos.acceptedEvidence.append(item as AcceptedEvidenceReference),
    );
    await this.loadCollection('fixture_corpus_references', (item) =>
      this.repos.fixtureCorpusReferences.append(item as PersistedFixtureCorpusReference),
    );
    await this.loadCollection('runtime_eligibility_evaluations', (item) =>
      this.repos.runtimeEligibilityEvaluations.append(item as RuntimeEligibilityEvaluationRecord),
    );
    await this.loadCollection('human_reviews', (item) =>
      this.repos.humanReviews.append(item as HumanGateRecord),
    );

    this.loaded = true;
  }

  private async loadCollection<T>(dir: string, saver: (item: T) => Promise<void>): Promise<void> {
    const path = this.collectionPath(dir);
    let files: string[];
    try {
      files = await readdir(path);
    } catch {
      return;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const content = await readFile(join(path, file), 'utf8');
      await saver(JSON.parse(content) as T);
    }
  }

  private wrapRepositoriesForDisk(): void {
    this.wrapForgeRuns();
    this.wrapPackVersions();
    this.wrapQualifications();
    this.wrapCertifications();
    this.wrapSourceSnapshots();
    this.wrapTransitions();
    this.wrapCertificationTransactions();
  }

  private wrapForgeRuns(): void {
    const base = this.repos.forgeRuns;
    this.repos.forgeRuns = {
      ...base,
      insert: async (run) => {
        await base.insert(run);
        await writeJson(join(this.collectionPath('forge_runs'), `${run.id}.json`), run);
      },
      save: async (run) => {
        await base.save(run);
        await writeJson(join(this.collectionPath('forge_runs'), `${run.id}.json`), run);
      },
    };

    const lifecycle = this.repos.forgeRunLifecycle;
    this.repos.forgeRunLifecycle = {
      applyTransition: async (input) => {
        const result = await lifecycle.applyTransition(input);
        await writeJson(
          join(this.collectionPath('forge_runs'), `${result.run.id}.json`),
          result.run,
        );
        const transitionId = `${result.record.forgeRunId}-${result.record.fromState}-${result.record.toState}-${result.record.action}`;
        await writeJson(
          join(this.collectionPath('forge_run_transitions'), `${transitionId}.json`),
          result.record,
        );
        return result;
      },
    };
  }

  private wrapPackVersions(): void {
    const base = this.repos.packVersions;
    this.repos.packVersions = {
      ...base,
      insert: async (version) => {
        await base.insert(version);
        await writeJson(join(this.collectionPath('pack_versions'), `${version.id}.json`), version);
      },
      save: async (version) => {
        await base.save(version);
        await writeJson(join(this.collectionPath('pack_versions'), `${version.id}.json`), version);
      },
    };

    const lifecycle = this.repos.packVersionLifecycle;
    this.repos.packVersionLifecycle = {
      applyTransition: async (input) => {
        const result = await lifecycle.applyTransition(input);
        await writeJson(
          join(this.collectionPath('pack_versions'), `${result.packVersion.id}.json`),
          result.packVersion,
        );
        const transitionId = `${result.record.packVersionId}-${result.record.fromState}-${result.record.toState}-${result.record.action}`;
        await writeJson(
          join(this.collectionPath('pack_version_transitions'), `${transitionId}.json`),
          result.record,
        );
        return result;
      },
    };
  }

  private wrapQualifications(): void {
    const base = this.repos.qualifications;
    this.repos.qualifications = {
      ...base,
      append: async (record) => {
        await base.append(record);
        await writeJson(join(this.collectionPath('qualifications'), `${record.id}.json`), record);
      },
    };
  }

  private wrapCertifications(): void {
    const base = this.repos.certifications;
    this.repos.certifications = {
      ...base,
      append: async (record) => {
        await base.append(record);
        await writeJson(join(this.collectionPath('certifications'), `${record.id}.json`), record);
      },
      save: async (record) => {
        await base.save(record);
        await writeJson(join(this.collectionPath('certifications'), `${record.id}.json`), record);
      },
    };
  }

  private wrapSourceSnapshots(): void {
    const base = this.repos.sourceSnapshots;
    this.repos.sourceSnapshots = {
      ...base,
      append: async (snapshot) => {
        await base.append(snapshot);
        await writeJson(
          join(this.collectionPath('sources'), `${snapshot.sourceSnapshotId}.json`),
          snapshot,
        );
      },
      save: async (snapshot) => {
        await base.save(snapshot);
        await writeJson(
          join(this.collectionPath('sources'), `${snapshot.sourceSnapshotId}.json`),
          snapshot,
        );
      },
    };

    const records = this.repos.sourceRecords;
    this.repos.sourceRecords = {
      ...records,
      save: async (record) => {
        await records.save(record);
        await writeJson(
          join(this.collectionPath('source_records'), `${record.identity.sourceId}.json`),
          record,
        );
      },
    };
  }

  private wrapTransitions(): void {
    const forgeTransitions = this.repos.forgeRunTransitions;
    this.repos.forgeRunTransitions = {
      ...forgeTransitions,
      append: async (record: ForgeRunTransitionRecord) => {
        await forgeTransitions.append(record);
        const transitionId = `${record.forgeRunId}-${record.fromState}-${record.toState}-${record.action}`;
        await writeJson(
          join(this.collectionPath('forge_run_transitions'), `${transitionId}.json`),
          record,
        );
      },
    };

    const packTransitions = this.repos.packVersionTransitions;
    this.repos.packVersionTransitions = {
      ...packTransitions,
      append: async (record: PackVersionTransitionRecord) => {
        await packTransitions.append(record);
        const transitionId = `${record.packVersionId}-${record.fromState}-${record.toState}-${record.action}`;
        await writeJson(
          join(this.collectionPath('pack_version_transitions'), `${transitionId}.json`),
          record,
        );
      },
    };
  }

  private wrapCertificationTransactions(): void {
    const base = this.repos.certificationTransactions;
    this.repos.certificationTransactions = {
      persistCertificationWithTransition: async (input) => {
        await base.persistCertificationWithTransition(input);
        await writeJson(
          join(this.collectionPath('certifications'), `${input.certification.id}.json`),
          input.certification,
        );
        await writeJson(
          join(this.collectionPath('pack_versions'), `${input.packVersion.id}.json`),
          input.packVersion,
        );
        const transitionId = `${input.transitionRecord.packVersionId}-${input.transitionRecord.fromState}-${input.transitionRecord.toState}-${input.transitionRecord.action}`;
        await writeJson(
          join(this.collectionPath('pack_version_transitions'), `${transitionId}.json`),
          input.transitionRecord,
        );
      },
    };
  }

  /** Backward-compatible helpers used by early bootstrap code paths. */
  async persistForgeRun(run: ForgeRun): Promise<void> {
    await this.repos.forgeRuns.save(run);
  }

  async persistPackVersion(version: PackVersion): Promise<void> {
    await this.repos.packVersions.save(version);
  }

  async persistCertification(record: CertificationRecord): Promise<void> {
    await this.repos.certifications.save(record);
  }

  async persistQualification(record: QualificationRecord): Promise<void> {
    await this.repos.qualifications.append(record);
  }

  async persistHumanReview(record: HumanGateRecord): Promise<void> {
    await this.repos.humanReviews.save(record);
  }
}
