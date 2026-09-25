import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ForgeRun,
  ForgeStageExecution,
  ForgeArtifact,
  PackVersion,
  CertificationRecord,
  SourceSnapshot,
} from '@domain-forge/contracts';
import type { HumanGateRecord } from '@domain-forge/core';
import type { ForgeRepositories } from './repositories.js';
import { createInMemoryRepositories } from './in-memory.js';

export interface JsonFilePersistenceOptions {
  baseDir: string;
}

/** JSON-file persistence adapter — loads on init, saves on write */
export class JsonFilePersistence {
  private readonly baseDir: string;
  private readonly repos: ForgeRepositories;
  private loaded = false;

  constructor(options: JsonFilePersistenceOptions) {
    this.baseDir = options.baseDir;
    this.repos = createInMemoryRepositories();
  }

  get repositories(): ForgeRepositories {
    return this.repos;
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.baseDir, { recursive: true });

    const collections = [
      'forge_runs',
      'stage_executions',
      'artifacts',
      'pack_versions',
      'certifications',
      'sources',
      'human_reviews',
      'validation_results',
      'fixture_executions',
      'budget_usage',
    ];

    for (const col of collections) {
      await mkdir(join(this.baseDir, col), { recursive: true });
    }

    await this.loadCollection('forge_runs', (item) =>
      this.repos.forgeRuns.save(item as ForgeRun),
    );
    await this.loadCollection('stage_executions', (item) =>
      this.repos.stageExecutions.save(item as ForgeStageExecution),
    );
    await this.loadCollection('artifacts', (item) =>
      this.repos.artifacts.save(item as ForgeArtifact),
    );
    await this.loadCollection('pack_versions', (item) =>
      this.repos.packVersions.save(item as PackVersion),
    );
    await this.loadCollection('certifications', (item) =>
      this.repos.certifications.save(item as CertificationRecord),
    );
    await this.loadCollection('sources', (item) =>
      this.repos.sourceSnapshots.save(item as SourceSnapshot),
    );
    await this.loadCollection('human_reviews', (item) =>
      this.repos.humanReviews.save(item as HumanGateRecord),
    );

    this.loaded = true;
  }

  private async loadCollection<T>(dir: string, saver: (item: T) => Promise<void>): Promise<void> {
    const path = join(this.baseDir, dir);
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

  async persistForgeRun(run: Parameters<ForgeRepositories['forgeRuns']['save']>[0]): Promise<void> {
    await this.repos.forgeRuns.save(run);
    await writeFile(
      join(this.baseDir, 'forge_runs', `${run.id}.json`),
      JSON.stringify(run, null, 2),
    );
  }

  async persistPackVersion(version: Parameters<ForgeRepositories['packVersions']['save']>[0]): Promise<void> {
    await this.repos.packVersions.save(version);
    await writeFile(
      join(this.baseDir, 'pack_versions', `${version.id}.json`),
      JSON.stringify(version, null, 2),
    );
  }

  async persistCertification(record: Parameters<ForgeRepositories['certifications']['save']>[0]): Promise<void> {
    await this.repos.certifications.save(record);
    await writeFile(
      join(this.baseDir, 'certifications', `${record.id}.json`),
      JSON.stringify(record, null, 2),
    );
  }

  async persistHumanReview(record: Parameters<ForgeRepositories['humanReviews']['save']>[0]): Promise<void> {
    await this.repos.humanReviews.save(record);
    await writeFile(
      join(this.baseDir, 'human_reviews', `${record.id}.json`),
      JSON.stringify(record, null, 2),
    );
  }
}
