import { isAbsolute, join, resolve } from 'node:path';
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
  const configuredDataDir = options.dataDir ?? process.env['FORGE_DATA_DIR'];
  const dataDir =
    configuredDataDir === undefined
      ? join(rootDir, '.data')
      : isAbsolute(configuredDataDir)
        ? configuredDataDir
        : resolve(rootDir, configuredDataDir);
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
