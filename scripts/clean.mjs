import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const WORKSPACE_DIRS = [
  'apps/cli',
  'apps/worker',
  'packages/pack-contract',
  'packages/core',
  'packages/contracts',
  'packages/schemas',
  'packages/evidence',
  'packages/sources',
  'packages/models',
  'packages/validation',
  'packages/stages',
  'packages/packs',
  'packages/fixtures',
  'packages/qualification',
  'packages/certification',
  'packages/persistence',
  'packages/orchestration',
  'packages/observability',
  'packages/testing',
];

function removeTsBuildInfo(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      removeTsBuildInfo(full);
    } else if (entry.endsWith('.tsbuildinfo')) {
      rmSync(full, { force: true });
    }
  }
}

for (const rel of WORKSPACE_DIRS) {
  const base = join(ROOT, rel);
  const dist = join(base, 'dist');
  rmSync(dist, { recursive: true, force: true });
  removeTsBuildInfo(base);
}

removeTsBuildInfo(ROOT);
