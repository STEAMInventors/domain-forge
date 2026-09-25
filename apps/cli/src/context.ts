import { join } from 'node:path';
import { JsonFilePersistence } from '@domain-forge/persistence';
import type { CliContext, OutputFormat } from './types.js';

export interface CreateCliContextOptions {
  readonly rootDir?: string;
  readonly dataDir?: string;
  readonly outputFormat?: OutputFormat;
}

export async function createCliContext(
  options: CreateCliContextOptions = {},
): Promise<CliContext> {
  const rootDir = options.rootDir ?? process.cwd();
  const dataDir = options.dataDir ?? join(rootDir, '.data');
  const persistence = new JsonFilePersistence({ baseDir: dataDir });
  await persistence.init();

  return {
    repos: persistence.repositories,
    rootDir,
    dataDir,
    outputFormat: options.outputFormat ?? 'human',
    qualificationProfilesDir: join(rootDir, 'configs', 'qualification', 'profiles'),
    certificationProfilesDir: join(rootDir, 'configs', 'certification', 'profiles'),
  };
}
