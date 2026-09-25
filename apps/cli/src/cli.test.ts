import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { createPackVersion } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  buildAcceptedFixtureCorpus,
  computeFixtureFingerprint,
  minimalFixtureCorpus,
  minimalFixtureDefinition,
} from '@domain-forge/fixtures';
import {
  DefaultQualificationExecutor,
  createQualificationProfileLoader,
  parseQualificationProfile,
} from '@domain-forge/qualification';
import type { CliContext } from './types.js';
import { ExitCode } from './exit-codes.js';
import { dispatchCommand } from './router.js';
import { cmdValidatePack } from './commands/validate-pack.js';
import { runQualificationCommand } from './services/qualification-run.js';
import { runCertificationCommand } from './services/certification-run.js';
import { checkRuntimeEligibility } from './services/runtime-eligibility-check.js';
import { emitResult } from './output.js';

const ROOT = join(import.meta.dirname, '../../..');

const TEST_QUAL_PROFILE = parseQualificationProfile({
  id: 'cli-test-profile',
  version: '1.0.0',
  requiredFixtureCategories: ['synthetic'],
  requiredMaterialClasses: ['synthetic'],
  requiredValidatorIds: [],
  requiredCompletenessValidators: [
    'extraction-contract-completeness',
    'output-specification-completeness',
  ],
  permittedExclusions: [],
  humanReviewRequirements: [],
  coverageRequirements: { minSyntheticFixtures: 1, requireAllPackFixtureReferences: true },
  layerARequired: true,
  layerBRequired: false,
  requiredExecutionTrust: 'REAL_HIVE',
  allowedPackVersionStates: ['DRAFT', 'PROVISIONAL'],
});

const TEST_CERT_PROFILE = {
  id: 'cli-test-cert',
  version: '1.0.0',
  requiredQualificationProfiles: [{ id: 'cli-test-profile', version: '1.0.0' }],
  layerARequired: true,
  layerBRequired: false,
  requiredReviewerRoles: ['DOMAIN_EXPERT'],
  requiredCompletenessValidators: [
    'extraction-contract-completeness',
    'output-specification-completeness',
  ],
  permitUnresolvedReviewItems: false,
};

function createTestContext(repos = createInMemoryRepositories()): CliContext {
  const profilesDir = mkdtempSync(join(tmpdir(), 'df-cli-profiles-'));
  writeFileSync(
    join(profilesDir, 'bootstrap-default-v1.json'),
    JSON.stringify({ ...TEST_QUAL_PROFILE, id: 'cli-test-profile' }),
  );

  const certProfilesDir = mkdtempSync(join(tmpdir(), 'df-cli-cert-'));
  writeFileSync(join(certProfilesDir, 'bootstrap-default-v1.json'), JSON.stringify(TEST_CERT_PROFILE));

  return {
    repos,
    rootDir: ROOT,
    dataDir: mkdtempSync(join(tmpdir(), 'df-cli-data-')),
    outputFormat: 'json',
    qualificationProfilesDir: profilesDir,
    certificationProfilesDir: certProfilesDir,
  };
}

async function seedPack(repos: CliContext['repos'], state: 'DRAFT' | 'PROVISIONAL' = 'DRAFT') {
  const pack = createMinimalTestPack();
  let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  await repos.packVersions.insert(packVersion);
  if (state === 'PROVISIONAL') {
    await repos.packVersionLifecycle.applyTransition({
      packVersionId: packVersion.id,
      action: 'PROMOTE_TO_PROVISIONAL',
      expectedFromState: 'DRAFT',
    });
    packVersion = (await repos.packVersions.get(packVersion.id))!;
    expect(packVersion.state).toBe('PROVISIONAL');
  }
  return packVersion;
}

async function seedCorpus(repos: CliContext['repos']) {
  const corpus = minimalFixtureCorpus();
  const accepted = buildAcceptedFixtureCorpus(corpus);
  await repos.fixtureCorpusReferences.append({
    fixtureCorpusHash: accepted.fixtureCorpusHash,
    corpus: accepted,
    persistedAt: new Date().toISOString(),
  });
  return accepted;
}

async function seedPassedQualification(ctx: CliContext) {
  const packVersion = await seedPack(ctx.repos, 'PROVISIONAL');
  const accepted = await seedCorpus(ctx.repos);
  const fixture = minimalFixtureDefinition();

  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([TEST_QUAL_PROFILE]),
  });
  const result = executor.execute({
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: TEST_QUAL_PROFILE.id,
    qualificationProfileVersion: TEST_QUAL_PROFILE.version,
    execution: {
      executionRunId: 'qual-run-001',
      executorTrustLevel: 'REAL_HIVE',
      hiveVersion: 'hive-test-1.0.0',
      executorVersion: 'executor-test-1.0.0',
      layerAMode: 'FACTS_IN',
    },
    fixtureExecutions: [
      {
        fixtureId: fixture.id,
        fixtureFingerprint: computeFixtureFingerprint(fixture),
        fixtureCategory: fixture.category,
        materialClass: fixture.provenance.materialClass,
        executionStatus: 'completed',
        goldEvaluation: { passed: true, findings: [{ status: 'match', message: 'ok' }] },
      },
    ],
  });

  expect(result.status).toBe('passed');
  await ctx.repos.qualifications.append(result.record!);
  return { packVersion, qualificationRecord: result.record! };
}

describe('CLI commands', () => {
  let ctx: CliContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  it('validate-pack succeeds for minimal test pack', async () => {
    const packVersion = await seedPack(ctx.repos);
    const result = await cmdValidatePack(ctx, packVersion.id);
    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    expect((result.payload as { validation: { passed: boolean } }).validation.passed).toBe(true);
  });

  it('validate-pack fails with structured errors for invalid pack', async () => {
    const pack = createMinimalTestPack();
    pack.rules[0] = { ...pack.rules[0]!, entityIds: ['missing-entity-id'] };
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    await ctx.repos.packVersions.insert(packVersion);

    const result = await cmdValidatePack(ctx, packVersion.id);
    expect(result.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('qualification command creates and persists QualificationRecord', async () => {
    const packVersion = await seedPack(ctx.repos);
    const accepted = await seedCorpus(ctx.repos);

    const result = await runQualificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationProfileId: TEST_QUAL_PROFILE.id,
      qualificationProfileVersion: TEST_QUAL_PROFILE.version,
      fixtureCorpusHash: accepted.fixtureCorpusHash,
      executionRunId: 'qual-run-cli-001',
      executorTrustLevel: 'REAL_HIVE',
      hiveVersion: 'hive-test-1.0.0',
      executorVersion: 'executor-test-1.0.0',
    });

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    const records = await ctx.repos.qualifications.listByPack(packVersion.packId);
    expect(records).toHaveLength(1);
    expect((await ctx.repos.packVersions.get(packVersion.id))!.state).not.toBe('CERTIFIED');
  });

  it('qualification does not certify the pack', async () => {
    const packVersion = await seedPack(ctx.repos, 'PROVISIONAL');
    const accepted = await seedCorpus(ctx.repos);

    await runQualificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationProfileId: TEST_QUAL_PROFILE.id,
      qualificationProfileVersion: TEST_QUAL_PROFILE.version,
      fixtureCorpusHash: accepted.fixtureCorpusHash,
      executionRunId: 'qual-run-cli-002',
      executorTrustLevel: 'REAL_HIVE',
      hiveVersion: 'hive-test-1.0.0',
      executorVersion: 'executor-test-1.0.0',
    });

    const loaded = await ctx.repos.packVersions.get(packVersion.id);
    expect(loaded!.state).toBe('PROVISIONAL');
    const certs = await ctx.repos.certifications.listByPack(packVersion.packId);
    expect(certs).toHaveLength(0);
  });

  it('certification succeeds with valid qualification', async () => {
    const { packVersion, qualificationRecord } = await seedPassedQualification(ctx);

    const result = await runCertificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationRecordId: qualificationRecord.id,
      certificationProfileId: TEST_CERT_PROFILE.id,
      certificationProfileVersion: TEST_CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
    });

    expect(result.exitCode).toBe(ExitCode.SUCCESS);
    const loaded = await ctx.repos.packVersions.get(packVersion.id);
    expect(loaded!.state).toBe('CERTIFIED');
  });

  it('certification fails without qualification record', async () => {
    const packVersion = await seedPack(ctx.repos, 'PROVISIONAL');

    const result = await runCertificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationRecordId: 'qual-missing' as never,
      certificationProfileId: TEST_CERT_PROFILE.id,
      certificationProfileVersion: TEST_CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
    });

    expect(result.exitCode).toBe(ExitCode.USAGE_OR_CONFIG);
  });

  it('certification fails with failed qualification status', async () => {
    const packVersion = await seedPack(ctx.repos, 'PROVISIONAL');
    const accepted = await seedCorpus(ctx.repos);

    const failed = await runQualificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationProfileId: TEST_QUAL_PROFILE.id,
      qualificationProfileVersion: TEST_QUAL_PROFILE.version,
      fixtureCorpusHash: accepted.fixtureCorpusHash,
      executionRunId: 'qual-run-failed',
      executorTrustLevel: 'FAKE',
      hiveVersion: 'hive-test-1.0.0',
      executorVersion: 'executor-test-1.0.0',
    });

    expect(failed.exitCode).not.toBe(ExitCode.SUCCESS);
    const records = await ctx.repos.qualifications.listByPack(packVersion.packId);
    expect(records.length).toBeGreaterThan(0);

    const result = await runCertificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationRecordId: records[0]!.id,
      certificationProfileId: TEST_CERT_PROFILE.id,
      certificationProfileVersion: TEST_CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
    });

    expect(result.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
  });

  it('certification rejects invalid reviewer role', async () => {
    const { packVersion, qualificationRecord } = await seedPassedQualification(ctx);

    const result = await runCertificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationRecordId: qualificationRecord.id,
      certificationProfileId: TEST_CERT_PROFILE.id,
      certificationProfileVersion: TEST_CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'NOT_A_REAL_ROLE' as never,
    });

    expect(result.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
    expect(result.errors?.some((error) => error.code.includes('REVIEWER'))).toBe(true);
  });

  it('certification persists atomically through certification transaction', async () => {
    const { packVersion, qualificationRecord } = await seedPassedQualification(ctx);

    await runCertificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationRecordId: qualificationRecord.id,
      certificationProfileId: TEST_CERT_PROFILE.id,
      certificationProfileVersion: TEST_CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
    });

    const transitions = await ctx.repos.packVersionTransitions.listByPackVersion(packVersion.id);
    expect(transitions.some((record) => record.action === 'CERTIFY')).toBe(true);
    const certs = await ctx.repos.certifications.listByPack(packVersion.packId);
    expect(certs.some((record) => record.decision.kind === 'certified')).toBe(true);
  });

  it('runtime eligibility returns reason codes for CERTIFIED-without-record', async () => {
    const packVersion = await seedPack(ctx.repos, 'PROVISIONAL');
    await ctx.repos.packVersionLifecycle.applyTransition({
      packVersionId: packVersion.id,
      action: 'CERTIFY',
      expectedFromState: 'PROVISIONAL',
    });

    const result = await checkRuntimeEligibility(ctx, {
      packVersionId: packVersion.id,
      hiveVersion: 'hive-test-1.0.0',
      suppliedCapabilities: [],
    });

    expect(result.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
    const decision = (result.payload as { decision: { reasons: { code: string }[] } }).decision;
    expect(decision.reasons.some((reason) => reason.code === 'CERTIFICATION_MISSING')).toBe(true);
  });

  it('JSON output shape includes exitCode and data', () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (value?: unknown) => {
      lines.push(String(value));
    };

    emitResult(
      {
        exitCode: ExitCode.SUCCESS,
        summary: 'ok',
        payload: { id: 'test-001' },
      },
      'json',
    );

    console.log = originalLog;
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.exitCode).toBe(0);
    expect(parsed.data.id).toBe('test-001');
  });

  it('returns non-zero exit for failed certification via router', async () => {
    const packVersion = await seedPack(ctx.repos, 'PROVISIONAL');
    const result = await dispatchCommand(ctx, [
      'certify',
      packVersion.id,
      'qual-missing',
      TEST_CERT_PROFILE.id,
      TEST_CERT_PROFILE.version,
      'reviewer-001',
      'DOMAIN_EXPERT',
    ]);
    expect(result.exitCode).not.toBe(ExitCode.SUCCESS);
  });

  it('requires exact profile/version without implicit latest selection', async () => {
    const packVersion = await seedPack(ctx.repos);
    const accepted = await seedCorpus(ctx.repos);

    const result = await runQualificationCommand(ctx, {
      packVersionId: packVersion.id,
      qualificationProfileId: 'missing-profile',
      qualificationProfileVersion: '9.9.9',
      fixtureCorpusHash: accepted.fixtureCorpusHash,
      executionRunId: 'qual-run-cli-003',
      executorTrustLevel: 'REAL_HIVE',
      hiveVersion: 'hive-test-1.0.0',
      executorVersion: 'executor-test-1.0.0',
    });

    expect(result.exitCode).not.toBe(ExitCode.SUCCESS);
    expect(result.errors?.some((error) => error.code === 'QUALIFICATION_PROFILE_MISSING')).toBe(true);
  });
});
