import { describe, it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWorkerLoop } from './index.js';

describe('worker entrypoint', () => {
  it('exports runWorkerLoop without starting an infinite loop on import', () => {
    expect(typeof runWorkerLoop).toBe('function');
  });

  it('runWorkerLoop respects maxIterations without polling indefinitely', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'df-worker-'));
    await expect(
      runWorkerLoop({ dataDir: dir, rootDir: process.cwd(), maxIterations: 1, pollIntervalMs: 1 }),
    ).resolves.toBeUndefined();
  });
});
