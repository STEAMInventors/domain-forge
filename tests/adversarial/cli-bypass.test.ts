import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { createPackVersion, applyPackVersionTransition } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import { dispatchCommand } from '../../apps/cli/src/router.js';
import { printHelp } from '../../apps/cli/src/help.js';
import { parseGlobalFlags } from '../../apps/cli/src/args.js';
import { ExitCode } from '../../apps/cli/src/exit-codes.js';
import type { CliContext } from '../../apps/cli/src/types.js';
import { checkRuntimeEligibility } from '../../apps/cli/src/services/runtime-eligibility-check.js';

const ROOT = join(import.meta.dirname, '../..');

function createTestContext(): CliContext {
  return {
    repos: createInMemoryRepositories(),
    rootDir: ROOT,
    dataDir: ROOT,
    outputFormat: 'json',
    qualificationProfilesDir: join(ROOT, 'configs/qualification/profiles'),
    certificationProfilesDir: join(ROOT, 'configs/certification/profiles'),
  };
}

describe('adversarial: CLI bypass resistance', () => {
  let ctx: CliContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it('help text does not expose --force, --skip-validation, or --certify-anyway', () => {
    const helpSource = readFileSync(join(ROOT, 'apps/cli/src/help.ts'), 'utf8');
    expect(helpSource).not.toMatch(/--force/);
    expect(helpSource).not.toMatch(/--skip-validation/);
    expect(helpSource).not.toMatch(/--certify-anyway/);
    expect(helpSource).not.toMatch(/implicit.*latest/i);
  });

  it('does not recognize bypass flags — they pass through as unknown commands or positional args', () => {
    const parsed = parseGlobalFlags(['--force', 'validate-pack', 'pack-id']);
    expect(parsed.positional).toContain('--force');
  });

  it('returns non-zero exit for unknown command', async () => {
    const result = await dispatchCommand(ctx, ['certify-anyway', 'pack-id']);
    expect(result.exitCode).toBe(ExitCode.USAGE_OR_CONFIG);
    expect(result.errors?.some((e) => e.code === 'UNKNOWN_COMMAND')).toBe(true);
  });

  it('returns USAGE_OR_CONFIG for malformed pack version id on validate-pack', async () => {
    const result = await dispatchCommand(ctx, ['validate-pack', 'not-a-valid-id']);
    expect(result.exitCode).toBe(ExitCode.USAGE_OR_CONFIG);
    expect(result.errors?.some((e) => e.code === 'PACK_VERSION_NOT_FOUND')).toBe(true);
  });

  it('requires exact profile version — rejects implicit latest', async () => {
    const pack = createMinimalTestPack();
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    await ctx.repos.packVersions.insert(packVersion);

    const result = await dispatchCommand(ctx, [
      'qualify',
      packVersion.id,
      'bootstrap-default',
      'latest',
      'a'.repeat(64),
      'run-001',
      'REAL_HIVE',
      'hive-1',
      'exec-1',
    ]);
    expect(result.exitCode).not.toBe(ExitCode.SUCCESS);
  });

  it('does not auto-certify on qualification command', async () => {
    const pack = createMinimalTestPack();
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    await ctx.repos.packVersions.insert(packVersion);

    await dispatchCommand(ctx, ['validate-pack', packVersion.id]);
    const stateAfter = (await ctx.repos.packVersions.get(packVersion.id))!.state;
    expect(stateAfter).not.toBe('CERTIFIED');
  });

  it('preserves machine-readable error codes in runtime-eligibility JSON result', async () => {
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;
    await ctx.repos.packVersions.insert(packVersion);

    const result = await checkRuntimeEligibility(ctx, {
      packVersionId: packVersion.id,
      hiveVersion: 'hive-test-1.0.0',
      suppliedCapabilities: [],
    });

    expect(result.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
    expect(result.errors?.some((e) => e.code === 'CERTIFICATION_MISSING')).toBe(true);
  });

  it('does not infer reviewer role — requires explicit argument', async () => {
    const helpLines: string[] = [];
    const originalLog = console.log;
    console.log = (value?: unknown) => {
      helpLines.push(String(value));
    };
    printHelp();
    console.log = originalLog;
    const help = helpLines.join('\n');
    expect(help).toContain('reviewerRole');
    expect(help).not.toMatch(/default.*reviewer/i);
  });
});
