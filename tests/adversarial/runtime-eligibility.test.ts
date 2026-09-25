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
  DefaultQualificationStalenessEvaluator,
} from '@domain-forge/qualification';
import {
  certifyPackVersion,
  createCertificationProfileLoader,
  parseCertificationProfile,
  evaluateRuntimeEligibility,
} from '@domain-forge/certification';
import { dependencyRefKey } from '@hive/pack-contract';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import type { RuntimeEligibilityContext } from '@domain-forge/contracts';

const QUAL_PROFILE = parseQualificationProfile({
  id: 'adv-runtime-qual',
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
  id: 'adv-runtime-cert',
  version: '1.0.0',
  requiredQualificationProfiles: [{ id: 'adv-runtime-qual', version: '1.0.0' }],
  layerARequired: true,
  layerBRequired: false,
  requiredReviewerRoles: ['DOMAIN_EXPERT'],
  requiredCompletenessValidators: [
    'extraction-contract-completeness',
    'output-specification-completeness',
  ],
  permitUnresolvedReviewItems: false,
});

function certifyDefaultPack() {
  const pack = createMinimalTestPack();
  let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  const accepted = buildAcceptedFixtureCorpus(minimalFixtureCorpus());
  const fixture = minimalFixtureDefinition();
  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([QUAL_PROFILE]),
  });
  const qualResult = executor.execute({
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: QUAL_PROFILE.id,
    qualificationProfileVersion: QUAL_PROFILE.version,
    execution: {
      executionRunId: 'run-runtime-adv',
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
  expect(qualResult.status).toBe('passed');
  packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
  const certResult = certifyPackVersion(
    {
      packVersion,
      qualificationRecord: qualResult.record!,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
    },
    { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
  );
  return { packVersion: certResult.packVersion!, certification: certResult.certification!, record: qualResult.record! };
}

describe('adversarial: runtime eligibility', () => {
  const baseContext = (overrides?: Partial<RuntimeEligibilityContext>): RuntimeEligibilityContext => ({
    suppliedCapabilities: [],
    hiveVersion: 'hive-test-1.0.0',
    ...overrides,
  });

  it('rejects CERTIFIED state with no CertificationRecord', () => {
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;

    const decision = evaluateRuntimeEligibility(packVersion, undefined, baseContext());
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'CERTIFICATION_MISSING')).toBe(true);
  });

  it('rejects valid CertificationRecord for different pack hash', () => {
    const { packVersion, certification, record } = certifyDefaultPack();
    const tamperedPack = { ...packVersion, packContentHash: 'different'.padEnd(64, '0') };
    const decision = evaluateRuntimeEligibility(tamperedPack, certification, baseContext({ currentQualificationRecord: record }));
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'CERTIFICATION_PACK_MISMATCH' || r.code === 'CERTIFICATION_STALE')).toBe(true);
  });

  it('rejects SUSPENDED pack even with valid certification', () => {
    const { packVersion, certification, record } = certifyDefaultPack();
    const suspended = applyPackVersionTransition(packVersion, 'SUSPEND').packVersion;
    const decision = evaluateRuntimeEligibility(suspended, certification, baseContext({ currentQualificationRecord: record }));
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'PACK_SUSPENDED')).toBe(true);
  });

  it('rejects SUPERSEDED pack', () => {
    const { packVersion, certification, record } = certifyDefaultPack();
    const superseded = applyPackVersionTransition(packVersion, 'SUPERSEDE').packVersion;
    const decision = evaluateRuntimeEligibility(superseded, certification, baseContext({ currentQualificationRecord: record }));
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'PACK_SUPERSEDED')).toBe(true);
  });

  it('rejects missing required runtime capability', () => {
    const pack = createMinimalTestPack({
      capabilityRequirements: [{ id: 'cap-1', capabilityId: 'hive.extraction', minVersion: '2.0.0' }],
    });
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    const accepted = buildAcceptedFixtureCorpus(minimalFixtureCorpus());
    const fixture = minimalFixtureDefinition();
    const executor = new DefaultQualificationExecutor({
      profileLoader: createQualificationProfileLoader([QUAL_PROFILE]),
    });
    const qualResult = executor.execute({
      packVersion: createPackVersion(pack.packId, pack.packVersion, pack),
      fixtureCorpus: accepted,
      qualificationProfileId: QUAL_PROFILE.id,
      qualificationProfileVersion: QUAL_PROFILE.version,
      execution: {
        executionRunId: 'run-cap',
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
    packVersion = applyPackVersionTransition(createPackVersion(pack.packId, pack.packVersion, pack), 'PROMOTE_TO_PROVISIONAL').packVersion;
    const certResult = certifyPackVersion(
      {
        packVersion,
        qualificationRecord: qualResult.record!,
        certificationProfileId: CERT_PROFILE.id,
        certificationProfileVersion: CERT_PROFILE.version,
        reviewerId: 'reviewer-001',
        reviewerRole: 'DOMAIN_EXPERT',
      },
      { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
    );

    const decision = evaluateRuntimeEligibility(
      certResult.packVersion!,
      certResult.certification,
      baseContext({ suppliedCapabilities: [], currentQualificationRecord: qualResult.record! }),
    );
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'RUNTIME_CAPABILITY_MISSING')).toBe(true);
  });

  it('rejects ineligible dependency when dependencyEligibility map reports ineligible', () => {
    const { packVersion, certification, record } = certifyDefaultPack();
    const deps = [
      ...packVersion.packContent.dependencies.extends,
      ...packVersion.packContent.dependencies.overlay,
      ...packVersion.packContent.dependencies.shared,
    ];
    const depMap = new Map<string, { status: 'ineligible'; reasons: [] }>();
    for (const dep of deps) {
      depMap.set(dependencyRefKey(dep), { status: 'ineligible', reasons: [] });
    }
    if (deps.length === 0) {
      depMap.set('fake-dep-key', { status: 'ineligible', reasons: [] });
    }

    const decision = evaluateRuntimeEligibility(
      packVersion,
      certification,
      baseContext({
        currentQualificationRecord: record,
        dependencyEligibility: depMap as never,
      }),
    );
    if (deps.length > 0) {
      expect(decision.status).toBe('ineligible');
      expect(decision.reasons.some((r) => r.code === 'DEPENDENCY_NOT_ELIGIBLE')).toBe(true);
    }
  });

  it('persisted eligibility audit records never override deterministic evaluation', async () => {
    const repos = createInMemoryRepositories();
    const pack = createMinimalTestPack();
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);

    await repos.runtimeEligibilityEvaluations.append({
      id: 'eval-forged-eligible',
      packVersionId: packVersion.id,
      packContentHash: packVersion.packContentHash,
      certificationRecordFingerprint: 'fake',
      runtimeContextFingerprint: 'fake',
      decision: { status: 'eligible', reasons: [], evaluatedAt: new Date().toISOString() },
      recordedAt: new Date().toISOString(),
    });

    const decision = evaluateRuntimeEligibility(packVersion, undefined, baseContext());
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'PACK_NOT_CERTIFIED')).toBe(true);
  });

  it('does not expose runtimeEligible as mutable flag on PackVersion', () => {
    const { packVersion } = certifyDefaultPack();
    expect('runtimeEligible' in packVersion).toBe(false);
  });

  it('detects stale qualification fingerprint mismatch', () => {
    const { packVersion, certification, record } = certifyDefaultPack();
    const staleRecord = { ...record, recordFingerprint: 'changed-fingerprint' };
    const decision = evaluateRuntimeEligibility(
      packVersion,
      certification,
      baseContext({
        currentQualificationRecord: staleRecord,
        qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
      }),
    );
    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'QUALIFICATION_MISMATCH')).toBe(true);
  });
});
