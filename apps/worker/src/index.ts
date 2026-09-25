import { join } from 'node:path';
import { createLogger } from '@domain-forge/observability';
import { JsonFilePersistence } from '@domain-forge/persistence';
import { ForgeOrchestrator } from '@domain-forge/orchestration';
import { isForgeRunResumable, isForgeRunTerminal } from '@domain-forge/core';

const POLL_INTERVAL_MS = 5000;
const DATA_DIR = join(process.cwd(), '.data');

async function runWorker(): Promise<void> {
  const logger = createLogger();
  logger.info('Domain Forge worker starting');

  const persistence = new JsonFilePersistence({ baseDir: DATA_DIR });
  await persistence.init();
  const orchestrator = new ForgeOrchestrator(persistence.repositories);

  while (true) {
    const runs = await persistence.repositories.forgeRuns.list();
    for (const run of runs) {
      if (isForgeRunTerminal(run.state)) continue;

      if (isForgeRunResumable(run.state) && run.state !== 'RUNNING') {
        logger.info('Resuming eligible run', { runId: run.id, state: run.state });
        await orchestrator.resumeRun(run.id);
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});
