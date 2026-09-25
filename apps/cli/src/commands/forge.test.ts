import { describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import type { CliContext } from '../types.js';
import { cmdForge } from './forge.js';

function context(): CliContext {
  return {
    repos: createInMemoryRepositories(),
    rootDir: 'C:/domain-forge',
    dataDir: 'C:/domain-forge/.forge/data',
    outputFormat: 'json',
    qualificationProfilesDir: 'C:/domain-forge/configs/qualification/profiles',
    certificationProfilesDir: 'C:/domain-forge/configs/certification/profiles',
  };
}

describe('cmdForge', () => {
  it('creates a real run and immutable domain-intent without inventing a pack', async () => {
    const ctx = context();
    const result = await cmdForge(ctx, ['IEP']);

    expect(result.exitCode).toBe(0);
    expect(result.payload).toMatchObject({
      domain: 'IEP',
      domainId: 'iep',
      runState: 'CREATED',
      targetPackId: 'pack-iep',
      targetPackVersion: '0.1.0',
      packCreated: false,
      nextStage: 'stage-0',
    });

    const runs = await ctx.repos.forgeRuns.list();
    expect(runs).toHaveLength(1);

    const artifacts = await ctx.repos.artifacts.listByRun(runs[0]!.id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      artifactType: 'domain-intent',
      immutable: true,
      content: {
        domainId: 'iep',
        domainLabel: 'IEP',
        jurisdiction: 'UNDETERMINED',
      },
    });

    const packs = await ctx.repos.packVersions.list();
    expect(packs).toHaveLength(0);
  });
});
