import { describe, it, expect } from 'vitest';
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
  certifyProvisionalPack,
  createCertificationProfileLoader,
  parseCertificationProfile,
  evaluateCertificationPrerequisites,
} from '@domain-forge/certification';
import { InvariantViolationError } from '@domain-forge/core';
import type { QualificationInput } from '@domain-forge/contracts';

const QUAL_PROFILE = parseQualificationProfile({
  id: 'adv-cert-qual',
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
  id: 'adv-cert-profile',
  version: '1.0.0',
  requiredQualificationProfiles: [{ id: 'adv-cert-qual', version: '1.0.0' }],
  layerARequired: true,
  layerBRequired: false,
  requiredReviewerRoles: ['DOMAIN_EXPERT'],
  requiredCompletenessValidators: [
    'extraction-contract-completeness',
    'output-specification-completeness',
  ],
  permitUnresolvedReviewItems: false,
});

function runPassedQualification() {
  const pack = createMinimalTestPack();
  const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  const accepted = buildAcceptedFixtureCorpus(minimalFixtureCorpus());
  const fixture = minimalFixtureDefinition();
  const input: QualificationInput = {
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: QUAL_PROFILE.id,
    qualificationProfileVersion: QUAL_PROFILE.version,
    execution: {
      executionRunId: 'run-cert-adv',
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
  };
  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([QUAL_PROFILE]),
  });
  const result = executor.execute(input);
  expect(result.status).toBe('passed');
  return { record: result.record!, packVersion };
}

describe('adversarial: certification bypass resistance', () => {
  const certLoader = createCertificationProfileLoader([CERT_PROFILE]);

  it('rejects certification when qualification record has failed status', () => {
    const { packVersion, record } = runPassedQualification();
    const provisional = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    const failedRecord = { ...record, status: 'failed' as const };

    const evaluation = evaluateCertificationPrerequisites({
      packVersion: provisional,
      qualificationRecord: failedRecord,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: certLoader,
    });

    expect(evaluation.canCertify).toBe(false);
    expect(evaluation.errors.some((e) => e.code === 'QUALIFICATION_FAILED')).toBe(true);
  });

  it('rejects certification with wrong pack content hash binding', () => {
    const { record, packVersion } = runPassedQualification();
    const provisional = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    const tamperedRecord = {
      ...record,
      identity: { ...record.identity, packContentHash: 'tampered'.padEnd(64, '0') },
    };

    const result = certifyPackVersion(
      {
        packVersion: provisional,
        qualificationRecord: tamperedRecord,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: certLoader },
    );
    expect(result.certification).toBeUndefined();
    expect(result.prerequisiteEvaluation?.canCertify).toBe(false);
    expect(result.prerequisiteEvaluation?.errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid reviewer role', () => {
    const { record, packVersion } = runPassedQualification();
    const provisional = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;

    const result = certifyPackVersion(
      {
        packVersion: provisional,
        qualificationRecord: record,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'MODEL_AGENT' as never,
      },
      { profileLoader: certLoader },
    );
    expect(result.certification).toBeUndefined();
    expect(result.prerequisiteEvaluation?.errors.some((e) => e.code.includes('REVIEWER'))).toBe(true);
  });

  it('rejects DRAFT pack direct certification attempt', () => {
    const { record, packVersion } = runPassedQualification();
    const result = certifyPackVersion(
      {
        packVersion,
        qualificationRecord: record,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: certLoader },
    );
    expect(result.certification).toBeUndefined();
    expect(result.prerequisiteEvaluation?.errors.some((e) => e.code.includes('LIFECYCLE'))).toBe(true);
  });

  it('legacy certifyProvisionalPack fails closed without qualification', () => {
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;

    expect(() =>
      certifyProvisionalPack({
        packVersion,
        reviewerId: 'r1',
        reviewerRole: 'DOMAIN_EXPERT',
      }),
    ).toThrow(InvariantViolationError);
  });

  it('rejects stale qualification via pack content hash change at prerequisite evaluation', () => {
    const { record, packVersion } = runPassedQualification();
    const provisional = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    const stalePack = {
      ...provisional,
      packContentHash: 'changed'.padEnd(64, '0'),
    };

    const evaluation = evaluateCertificationPrerequisites({
      packVersion: stalePack,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: certLoader,
    });

    expect(evaluation.canCertify).toBe(false);
    expect(evaluation.errors.some((e) => e.code === 'PACK_HASH_MISMATCH')).toBe(true);
  });

  it('successful certification binds to exact packContentHash', () => {
    const { record, packVersion } = runPassedQualification();
    const provisional = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    const result = certifyPackVersion(
      {
        packVersion: provisional,
        qualificationRecord: record,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: certLoader },
    );
    expect(result.certification?.packContentHash).toBe(provisional.packContentHash);
    expect(result.packVersion?.state).toBe('CERTIFIED');
  });
});
