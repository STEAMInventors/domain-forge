import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPackVersion, applyPackVersionTransition } from '@domain-forge/packs';
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
  DefaultQualificationStalenessEvaluator,
} from '@domain-forge/qualification';
import { certifyPackVersion, createCertificationProfileLoader, parseCertificationProfile } from '@domain-forge/certification';
import type {
  FixtureExecutionResult,
  QualificationInput,
  QualificationRecord,
} from '@domain-forge/contracts';
import {
  asEvidenceId,
  asForgeRunId,
  asSourceId,
  asSourceSnapshotId,
  emptyBudgetUsage,
} from '@domain-forge/core';
import { createInMemoryRepositories } from './in-memory.js';
import { JsonFilePersistence } from './json-file.js';
import { createExtractionQualificationResolver, createPackStatusResolver } from './resolvers.js';
import type { ForgeRepositories } from './repositories.js';

const QUAL_PROFILE = parseQualificationProfile({
  id: 'test-profile',
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

const CERT_PROFILE = parseCertificationProfile({
  id: 'test-cert-profile',
  version: '1.0.0',
  requiredQualificationProfiles: [{ id: 'test-profile', version: '1.0.0' }],
  layerARequired: true,
  layerBRequired: false,
  requiredReviewerRoles: ['DOMAIN_EXPERT'],
  requiredCompletenessValidators: [
    'extraction-contract-completeness',
    'output-specification-completeness',
  ],
  permitUnresolvedReviewItems: false,
});

function buildQualificationInput(): QualificationInput {
  const pack = createMinimalTestPack();
  const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  const corpus = minimalFixtureCorpus();
  const accepted = buildAcceptedFixtureCorpus(corpus);
  const fixture = minimalFixtureDefinition();
  const defaultExecutions: FixtureExecutionResult[] = [
    {
      fixtureId: fixture.id,
      fixtureFingerprint: computeFixtureFingerprint(fixture),
      fixtureCategory: fixture.category,
      materialClass: fixture.provenance.materialClass,
      executionStatus: 'completed',
      goldEvaluation: { passed: true, findings: [{ status: 'match', message: 'ok' }] },
    },
  ];

  return {
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: QUAL_PROFILE.id,
    qualificationProfileVersion: QUAL_PROFILE.version,
    execution: {
      executionRunId: 'run-001',
      executorTrustLevel: 'REAL_HIVE',
      hiveVersion: 'hive-test-1.0.0',
      executorVersion: 'executor-test-1.0.0',
      layerAMode: 'FACTS_IN',
    },
    fixtureExecutions: defaultExecutions,
  };
}

function runQualification(): QualificationRecord {
  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([QUAL_PROFILE]),
  });
  const result = executor.execute(buildQualificationInput());
  expect(result.status).toBe('passed');
  return result.record!;
}

function provisionalPack() {
  const pack = createMinimalTestPack();
  const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  return applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
}

describe('persistence repositories', () => {
  let repos: ForgeRepositories;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it('stores and retrieves PackVersion with hash preserved', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);

    const loaded = await repos.packVersions.get(packVersion.id);
    expect(loaded?.packContentHash).toBe(packVersion.packContentHash);
    expect(loaded?.packId).toBe(packVersion.packId);
  });

  it('handles duplicate immutable PackVersion insert deterministically', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);
    await expect(repos.packVersions.insert(packVersion)).resolves.toBeUndefined();
    await expect(
      repos.packVersions.insert({ ...packVersion, updatedAt: '2099-01-01T00:00:00.000Z' }),
    ).rejects.toMatchObject({
      persistenceCode: 'DUPLICATE_IMMUTABLE_RECORD',
    });
  });

  it('rejects direct PackVersion state mutation via save', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);
    await expect(
      repos.packVersions.save({ ...packVersion, state: 'PROVISIONAL' }),
    ).rejects.toMatchObject({ persistenceCode: 'IMMUTABLE_RECORD_MODIFICATION' });
  });

  it('returns record not found for missing PackVersion', async () => {
    const missing = await repos.packVersions.get('missing' as never);
    expect(missing).toBeUndefined();
  });

  it('persists valid lifecycle transition and history', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);

    const { packVersion: updated, record } = await repos.packVersionLifecycle.applyTransition({
      packVersionId: packVersion.id,
      action: 'PROMOTE_TO_PROVISIONAL',
      expectedFromState: 'DRAFT',
    });

    expect(updated.state).toBe('PROVISIONAL');
    const history = await repos.packVersionTransitions.listByPackVersion(packVersion.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(record);
  });

  it('rejects illegal lifecycle transition persistence', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);

    await expect(
      repos.packVersionLifecycle.applyTransition({
        packVersionId: packVersion.id,
        action: 'CERTIFY',
        expectedFromState: 'DRAFT',
      }),
    ).rejects.toThrow();
  });

  it('detects optimistic concurrency conflict on lifecycle transition', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.packVersions.insert(packVersion);

    await expect(
      repos.packVersionLifecycle.applyTransition({
        packVersionId: packVersion.id,
        action: 'PROMOTE_TO_PROVISIONAL',
        expectedFromState: 'PROVISIONAL',
      }),
    ).rejects.toMatchObject({ persistenceCode: 'INVALID_PERSISTED_LIFECYCLE_TRANSITION' });
  });

  it('persists QualificationRecord immutably with multiple historical records', async () => {
    const recordA = runQualification();
    const recordB = {
      ...recordA,
      id: `${recordA.id}-rerun` as QualificationRecord['id'],
      executedAt: new Date(Date.now() + 1000).toISOString(),
      recordFingerprint: `${recordA.recordFingerprint}-rerun`,
    };

    await repos.qualifications.append(recordA);
    await repos.qualifications.append(recordB);

    const byHash = await repos.qualifications.findByPackContentHash(
      recordA.identity.packId,
      recordA.identity.packContentHash,
    );
    expect(byHash).toHaveLength(2);
    await expect(repos.qualifications.append(recordA)).resolves.toBeUndefined();
    await expect(
      repos.qualifications.append({
        ...recordA,
        recordFingerprint: 'changed',
      }),
    ).rejects.toMatchObject({ persistenceCode: 'DUPLICATE_IMMUTABLE_RECORD' });
  });

  it('persists certification atomically with lifecycle transition', async () => {
    const qualificationRecord = runQualification();
    const packVersion = provisionalPack();
    await repos.packVersions.insert(packVersion);
    await repos.qualifications.append(qualificationRecord);

    const certified = certifyPackVersion(
      {
        packVersion,
        qualificationRecord,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
    );

    expect(certified.certification).toBeDefined();
    await repos.certificationTransactions.persistCertificationWithTransition({
      certification: certified.certification!,
      packVersion: certified.packVersion!,
      transitionRecord: certified.transitionRecord!,
      expectedFromState: 'PROVISIONAL',
    });

    const loaded = await repos.packVersions.get(packVersion.id);
    expect(loaded?.state).toBe('CERTIFIED');
    const cert = await repos.certifications.get(certified.certification!.id);
    expect(cert?.packContentHash).toBe(packVersion.packContentHash);
  });

  it('rolls back certification transaction on partial failure', async () => {
    const qualificationRecord = runQualification();
    const packVersion = provisionalPack();
    await repos.packVersions.insert(packVersion);
    await repos.qualifications.append(qualificationRecord);

    const certified = certifyPackVersion(
      {
        packVersion,
        qualificationRecord,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
    );

    const badTransition = {
      ...certified.transitionRecord!,
      toState: 'SUSPENDED' as const,
    };

    await expect(
      repos.certificationTransactions.persistCertificationWithTransition({
        certification: certified.certification!,
        packVersion: { ...certified.packVersion!, state: 'SUSPENDED' },
        transitionRecord: badTransition,
        expectedFromState: 'PROVISIONAL',
      }),
    ).rejects.toMatchObject({ persistenceCode: 'INVALID_PERSISTED_LIFECYCLE_TRANSITION' });

    const loaded = await repos.packVersions.get(packVersion.id);
    expect(loaded?.state).toBe('PROVISIONAL');
    expect(await repos.certifications.get(certified.certification!.id)).toBeUndefined();
  });

  it('does not store mutable runtimeEligible flag', async () => {
    const keys = Object.keys(repos);
    expect(keys.some((k) => k.toLowerCase().includes('runtimeeligible'))).toBe(false);
    expect(keys.some((k) => k.toLowerCase().includes('runtime_eligible'))).toBe(false);
  });

  it('stores runtime eligibility evaluations as historical audit records', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await repos.runtimeEligibilityEvaluations.append({
      id: 'eval-001',
      packVersionId: packVersion.id,
      packContentHash: packVersion.packContentHash,
      certificationRecordFingerprint: 'cert-fp',
      runtimeContextFingerprint: 'ctx-fp',
      decision: {
        status: 'eligible',
        reasons: [],
        evaluatedAt: new Date().toISOString(),
      },
      recordedAt: new Date().toISOString(),
    });

    const records = await repos.runtimeEligibilityEvaluations.listByPackVersion(packVersion.id);
    expect(records).toHaveLength(1);
    expect(records[0]?.decision.status).toBe('eligible');
  });

  it('keeps source snapshots immutable and creates new snapshot for changed content', async () => {
    const snapshotA = {
      sourceSnapshotId: asSourceSnapshotId('snap-001'),
      sourceId: asSourceId('source-001'),
      url: 'https://example.test/doc',
      retrievalTimestamp: new Date().toISOString(),
      rawContent: 'raw',
      extractedRawText: 'raw',
      normalizedText: 'normalized',
      contentHash: 'hash-a',
      extractionVersion: 'v0',
      normalizationVersion: 'v0',
    };
    const snapshotB = { ...snapshotA, sourceSnapshotId: asSourceSnapshotId('snap-002'), contentHash: 'hash-b', normalizedText: 'changed' };

    await repos.sourceSnapshots.append(snapshotA);
    await repos.sourceSnapshots.append(snapshotB);

    expect(await repos.sourceSnapshots.getByContentHash('hash-a')).toBeDefined();
    expect(await repos.sourceSnapshots.getByContentHash('hash-b')).toBeDefined();
    await expect(repos.sourceSnapshots.append({ ...snapshotA, normalizedText: 'mutated' })).rejects.toMatchObject({
      persistenceCode: 'DUPLICATE_IMMUTABLE_RECORD',
    });
  });

  it('persists accepted evidence separately from proposed evidence', async () => {
    await repos.proposedEvidence.append({
      source: 'MODEL',
      sourceId: 'source-001',
      locator: { kind: 'paragraph', index: 0 },
      recordedAt: new Date().toISOString(),
    });
    await repos.acceptedEvidence.append({
      source: 'VALIDATED',
      evidenceId: asEvidenceId('evidence-001'),
      sourceId: asSourceId('source-001'),
      sourceContentFingerprint: 'hash-a',
      locator: { kind: 'paragraph', index: 0 },
      quoteVerified: true,
      evidenceReferenceHash: 'evidence-hash',
    });

    expect(await repos.acceptedEvidence.get(asEvidenceId('evidence-001'))).toBeDefined();
    expect((await repos.proposedEvidence.listBySource(asSourceId('source-001'))).length).toBe(1);
  });

  it('persists ForgeRun lifecycle without direct state mutation', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    const run = {
      id: asForgeRunId('run-001'),
      packId: packVersion.packId,
      packVersionId: packVersion.id,
      domainId: 'domain-neutral-test',
      state: 'CREATED' as const,
      budget: {
        maxModelInvocations: 10,
        maxInputTokens: 1000,
        maxOutputTokens: 1000,
        maxTotalTokens: 2000,
        maxRetryAttempts: 1,
        maxRuleReviewRounds: 1,
      },
      budgetUsage: emptyBudgetUsage(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repos.forgeRuns.insert(run);
    const started = await repos.forgeRunLifecycle.applyTransition({
      forgeRunId: run.id,
      action: 'START',
      expectedFromState: 'CREATED',
    });
    expect(started.run.state).toBe('RUNNING');

    await expect(repos.forgeRuns.save({ ...started.run, state: 'COMPLETED' })).rejects.toMatchObject({
      persistenceCode: 'IMMUTABLE_RECORD_MODIFICATION',
    });
  });

  it('resolves pack status from persisted records', async () => {
    const qualificationRecord = runQualification();
    const packVersion = provisionalPack();
    await repos.packVersions.insert(packVersion);
    await repos.qualifications.append(qualificationRecord);

    const certified = certifyPackVersion(
      {
        packVersion,
        qualificationRecord,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
    );

    await repos.certificationTransactions.persistCertificationWithTransition({
      certification: certified.certification!,
      packVersion: certified.packVersion!,
      transitionRecord: certified.transitionRecord!,
      expectedFromState: 'PROVISIONAL',
    });

    const resolver = createPackStatusResolver(repos);
    const status = await resolver.resolve(packVersion.id);
    expect(status?.lifecycleState).toBe('CERTIFIED');
    expect(status?.certificationRecord?.recordFingerprint).toBe(
      certified.certification!.recordFingerprint,
    );
  });

  it('resolves extraction qualification from persisted records', async () => {
    const record = runQualification();
    await repos.qualifications.append(record);

    const resolver = createExtractionQualificationResolver(repos, {
      qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
    });
    const resolution = await resolver.resolve(record.identity.packId, record.identity.packContentHash, {
      hiveVersion: record.execution.hiveVersion,
      extractionModelFamily: 'test-family',
      extractionModelVersion: '1.0.0',
      extractionPolicyVersion: 'policy-1',
    });

    expect(resolution?.state).toBe('NOT_TESTED');
    expect(resolution?.qualificationRecord?.id).toBe(record.id);
  });
});

describe('JSON-file persistence', () => {
  it('round-trips records with validation on load', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'domain-forge-persist-'));
    try {
      const persistence = new JsonFilePersistence({ baseDir: dir });
      await persistence.init();

      const packVersion = createPackVersion('pack-json', '1.0.0', createMinimalTestPack());
      await persistence.repositories.packVersions.insert(packVersion);

      const reloaded = new JsonFilePersistence({ baseDir: dir });
      await reloaded.init();
      const loaded = await reloaded.repositories.packVersions.get(packVersion.id);
      expect(loaded?.packContentHash).toBe(packVersion.packContentHash);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
