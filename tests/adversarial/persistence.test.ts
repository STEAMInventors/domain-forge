import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
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
} from '@domain-forge/qualification';
import {
  certifyPackVersion,
  createCertificationProfileLoader,
  parseCertificationProfile,
} from '@domain-forge/certification';
import { createInMemoryRepositories, JsonFilePersistence } from '@domain-forge/persistence';
import { asEvidenceId, asSourceId } from '@domain-forge/core';
import type { QualificationRecord } from '@domain-forge/contracts';

const QUAL_PROFILE = parseQualificationProfile({
  id: 'adv-persist-qual',
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
  id: 'adv-persist-cert',
  version: '1.0.0',
  requiredQualificationProfiles: [{ id: 'adv-persist-qual', version: '1.0.0' }],
  layerARequired: true,
  layerBRequired: false,
  requiredReviewerRoles: ['DOMAIN_EXPERT'],
  requiredCompletenessValidators: [
    'extraction-contract-completeness',
    'output-specification-completeness',
  ],
  permitUnresolvedReviewItems: false,
});

function runQualification(): QualificationRecord {
  const pack = createMinimalTestPack();
  const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  const accepted = buildAcceptedFixtureCorpus(minimalFixtureCorpus());
  const fixture = minimalFixtureDefinition();
  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([QUAL_PROFILE]),
  });
  const result = executor.execute({
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: QUAL_PROFILE.id,
    qualificationProfileVersion: QUAL_PROFILE.version,
    execution: {
      executionRunId: 'run-persist-adv',
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
        goldEvaluation: { passed: true, findings: [] },
      },
    ],
  });
  expect(result.status).toBe('passed');
  return result.record!;
}

describe('adversarial: persistence atomicity and immutability', () => {
  let repos: ReturnType<typeof createInMemoryRepositories>;

  beforeEach(() => {
    repos = createInMemoryRepositories();
  });

  it('rejects duplicate same-id different-content immutable QualificationRecord', async () => {
    const record = runQualification();
    await repos.qualifications.append(record);
    await expect(
      repos.qualifications.append({ ...record, recordFingerprint: 'tampered-fingerprint' }),
    ).rejects.toMatchObject({ persistenceCode: 'DUPLICATE_IMMUTABLE_RECORD' });
  });

  it('rejects update to existing CertificationRecord', async () => {
    const record = runQualification();
    let packVersion = createPackVersion(createMinimalTestPack().packId, '0.1.0', createMinimalTestPack());
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    await repos.packVersions.insert(packVersion);
    await repos.qualifications.append(record);

    const certified = certifyPackVersion(
      {
        packVersion,
        qualificationRecord: record,
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

    await expect(
      repos.certifications.append({
        ...certified.certification!,
        recordFingerprint: 'tampered',
      }),
    ).rejects.toMatchObject({ persistenceCode: 'DUPLICATE_IMMUTABLE_RECORD' });
  });

  it('rolls back certification transaction on invalid lifecycle transition', async () => {
    const record = runQualification();
    let packVersion = createPackVersion(createMinimalTestPack().packId, '0.1.0', createMinimalTestPack());
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    await repos.packVersions.insert(packVersion);
    await repos.qualifications.append(record);

    const certified = certifyPackVersion(
      {
        packVersion,
        qualificationRecord: record,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
    );

    await expect(
      repos.certificationTransactions.persistCertificationWithTransition({
        certification: certified.certification!,
        packVersion: { ...certified.packVersion!, state: 'SUSPENDED' },
        transitionRecord: { ...certified.transitionRecord!, toState: 'SUSPENDED' },
        expectedFromState: 'PROVISIONAL',
      }),
    ).rejects.toMatchObject({ persistenceCode: 'INVALID_PERSISTED_LIFECYCLE_TRANSITION' });

    const loaded = await repos.packVersions.get(packVersion.id);
    expect(loaded?.state).toBe('PROVISIONAL');
  });

  it('rejects content/hash mismatch on PackVersion hydrate', async () => {
    const packVersion = createPackVersion('pack-a', '1.0.0', createMinimalTestPack());
    await expect(
      repos.packVersions.insert({ ...packVersion, packContentHash: 'wrong'.padEnd(64, '0') }),
    ).rejects.toMatchObject({ persistenceCode: 'MALFORMED_PERSISTED_RECORD' });
  });

  it('keeps accepted and proposed evidence in separate stores', async () => {
    await repos.proposedEvidence.append({
      source: 'MODEL',
      sourceId: asSourceId('source-001'),
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
    const proposed = await repos.proposedEvidence.listBySource(asSourceId('source-001'));
    expect(proposed).toHaveLength(1);
    expect(proposed[0]?.source).toBe('MODEL');
  });

  it('rejects corrupt JSON on hydrate from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'df-adversarial-persist-'));
    try {
      await mkdir(join(dir, 'pack_versions'), { recursive: true });
      await writeFile(join(dir, 'pack_versions', 'corrupt.json'), '{ not valid json', 'utf8');

      const persistence = new JsonFilePersistence({ baseDir: dir });
      await expect(persistence.init()).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported serialized schema on hydrate', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'df-adversarial-persist-'));
    try {
      await mkdir(join(dir, 'pack_versions'), { recursive: true });
      await writeFile(
        join(dir, 'pack_versions', 'bad-pack.json'),
        JSON.stringify({ id: '', packId: '', version: '', packContentHash: '', packContent: {}, state: 'DRAFT' }),
        'utf8',
      );

      const persistence = new JsonFilePersistence({ baseDir: dir });
      await expect(persistence.init()).rejects.toMatchObject({
        persistenceCode: 'MALFORMED_PERSISTED_RECORD',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
