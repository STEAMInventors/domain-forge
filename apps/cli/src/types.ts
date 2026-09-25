import type { ForgeRepositories } from '@domain-forge/persistence';
import type { ExitCodeValue } from './exit-codes.js';

export type OutputFormat = 'json' | 'human';

export interface CliContext {
  readonly repos: ForgeRepositories;
  readonly rootDir: string;
  readonly dataDir: string;
  readonly outputFormat: OutputFormat;
  readonly qualificationProfilesDir: string;
  readonly certificationProfilesDir: string;
}

export interface CommandError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface CommandResult {
  readonly exitCode: ExitCodeValue;
  readonly summary?: string;
  readonly payload?: unknown;
  readonly errors?: readonly CommandError[];
}
