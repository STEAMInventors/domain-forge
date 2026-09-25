import { join } from 'node:path';
import { createLogger } from '@domain-forge/observability';
import { JsonFilePersistence } from '@domain-forge/persistence';
import { ForgeOrchestrator } from '@domain-forge/orchestration';
import { isForgeRunResumable, isForgeRunTerminal } from '@domain-forge/core';
import { processAllForgeRunsOnce } from './run-processor.js';

const POLL_INTERVAL_MS = 5000;
const DATA_DIR = join(process.cwd(), '.data');

export interface WorkerLoopOptions {
  readonly dataDir?: string;
  readonly rootDir?: string;
  readonly pollIntervalMs?: number;
  readonly maxIterations?: number;
  readonly allowRunningRecovery?: boolean;
}

export async function runWorkerLoop(options: WorkerLoopOptions = {}): Promise<void> {
  const logger = createLogger();
  const rootDir = options.rootDir ?? process.cwd();
  const dataDir = options.dataDir ?? DATA_DIR;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const maxIterations = options.maxIterations ?? Number.POSITIVE_INFINITY;

  logger.info('Domain Forge worker starting', { dataDir, allowRunningRecovery: options.allowRunningRecovery ?? false });

  const persistence = new JsonFilePersistence({ baseDir: dataDir });
  await persistence.init();
  const orchestrator = new ForgeOrchestrator(persistence.repositories);

  let iteration = 0;
  while (iteration < maxIterations) {
    const runs = await persistence.repositories.forgeRuns.list();

    for (const run of runs) {
      if (isForgeRunTerminal(run.state)) continue;

      if (isForgeRunResumable(run.state) && run.state !== 'RUNNING') {
        logger.info('Resuming eligible run', { runId: run.id, state: run.state });
        await orchestrator.resumeRun(run.id);
      }
    }

    const results = await processAllForgeRunsOnce(persistence.repositories, {
      rootDir,
      allowRunningRecovery: options.allowRunningRecovery ?? false,
    });

    for (const result of results) {
      if (result.action !== 'skipped') {
        logger.info('Processed forge run', { ...result });
      }
    }

    iteration += 1;
    if (iteration >= maxIterations) break;
    await sleep(pollIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
