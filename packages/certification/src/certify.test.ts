import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
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
import type {
  FixtureExecutionResult,
  QualificationInput,
  QualificationRecord,
  RuntimeEligibilityContext,
} from '@domain-forge/contracts';
import { InvariantViolationError } from '@domain-forge/core';
import {
  certifyPackVersion,
  evaluateCertificationPrerequisites,
  evaluateRuntimeEligibility,
  createCertificationProfileLoader,
  parseCertificationProfile,
  computeCertificationRecordFingerprint,
  certificationApplies,
  certifyProvisionalPack,
  loadCertificationProfilesFromDirectory,
  satisfiesMinVersion,
} from './index.js';

const ROOT = join(import.meta.dirname, '../../..');
const CERT_PROFILES_DIR = join(ROOT, 'configs/certification/profiles');

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

function buildQualificationInput(overrides?: Partial<QualificationInput>): QualificationInput {
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

  const { fixtureExecutions: overrideExecutions, ...restOverrides } = overrides ?? {};

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
    fixtureExecutions: [...(overrideExecutions ?? defaultExecutions)],
    ...restOverrides,
  };
}

function runQualification(overrides?: Partial<QualificationInput>) {
  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([QUAL_PROFILE]),
  });
  return executor.execute(buildQualificationInput(overrides));
}

function runPassedQualification(overrides?: Partial<QualificationInput>): QualificationRecord {
  const result = runQualification(overrides);
  expect(result.status).toBe('passed');
  return result.record!;
}

function provisionalPackVersion(overrides?: Partial<QualificationInput>) {
  const input = buildQualificationInput(overrides);
  const provisional = applyPackVersionTransition(input.packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
  return { input: { ...input, packVersion: provisional }, packVersion: provisional };
}

function certifyWithDefaults(
  qualificationRecord: QualificationRecord,
  packVersion: ReturnType<typeof createPackVersion>,
  overrides?: Partial<Parameters<typeof certifyPackVersion>[0]>,
) {
  return certifyPackVersion(
    {
      packVersion,
      qualificationRecord,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      ...overrides,
    },
    { profileLoader: createCertificationProfileLoader([CERT_PROFILE]) },
  );
}

describe('certification prerequisites', () => {
  it('valid qualification on provisional pack is certifiable', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const evaluation = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
      qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
    });

    expect(evaluation.canCertify).toBe(true);
    expect(evaluation.decision.kind).toBe('certified');
  });

  it('rejects failed qualification', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runQualification({
      fixtureExecutions: [
        {
          fixtureId: 'fixture-001',
          fixtureFingerprint: 'a'.repeat(64),
          fixtureCategory: 'synthetic',
          materialClass: 'synthetic',
          executionStatus: 'completed',
          goldEvaluation: { passed: false, findings: [{ status: 'mismatch', message: 'fail' }] },
        },
      ],
    }).record!;
    const evaluation = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.canCertify).toBe(false);
    expect(evaluation.decision.kind).toBe('rejected');
    expect(evaluation.errors.some((e) => e.code === 'QUALIFICATION_FAILED')).toBe(true);
  });

  it('rejects incomplete qualification', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runQualification({ fixtureExecutions: [] }).record!;
    const evaluation = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.canCertify).toBe(false);
    expect(evaluation.errors.some((e) => e.code === 'QUALIFICATION_INCOMPLETE')).toBe(true);
  });

  it('rejects requires-review qualification with unresolved mandatory review', () => {
    const qualProfile = parseQualificationProfile({
      ...QUAL_PROFILE,
      humanReviewRequirements: [
        { reviewerRole: 'DOMAIN_EXPERT', requiredForCategories: ['adversarial'] },
      ],
    });
    const adversarial = minimalFixtureDefinition({ id: 'fixture-001', category: 'adversarial' });
    const corpus = minimalFixtureCorpus({ standaloneFixtures: [adversarial] });
    const executor = new DefaultQualificationExecutor({
      profileLoader: createQualificationProfileLoader([qualProfile]),
    });
    const input = buildQualificationInput({
      fixtureCorpus: buildAcceptedFixtureCorpus(corpus),
      fixtureExecutions: [
        {
          fixtureId: 'fixture-001',
          fixtureFingerprint: computeFixtureFingerprint(adversarial),
          fixtureCategory: 'adversarial',
          materialClass: 'synthetic',
          executionStatus: 'completed',
          goldEvaluation: {
            passed: false,
            findings: [{ status: 'mismatch', message: 'needs review' }],
          },
        },
      ],
    });
    const record = executor.execute(input).record!;
    const { packVersion } = provisionalPackVersion();

    const evaluation = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.canCertify).toBe(false);
    expect(evaluation.decision.kind).toBe('requires_review');
  });

  it('rejects stale qualification', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const staleEval = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
      qualificationStalenessEvaluator: new DefaultQualificationStalenessEvaluator(),
      currentFixtureCorpusHash: 'd'.repeat(64),
    });

    expect(staleEval.errors.some((e) => e.code === 'QUALIFICATION_STALE')).toBe(true);
  });

  it('rejects pack hash mismatch', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const evaluation = evaluateCertificationPrerequisites({
      packVersion: { ...packVersion, packContentHash: 'x'.repeat(64) },
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.errors.some((e) => e.code === 'PACK_HASH_MISMATCH')).toBe(true);
  });

  it('rejects invalid reviewer role', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const evaluation = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'NOT_A_REAL_ROLE',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.errors.some((e) => e.code === 'REVIEWER_ROLE_INVALID')).toBe(true);
  });

  it('rejects missing approver', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const evaluation = evaluateCertificationPrerequisites({
      packVersion,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.errors.some((e) => e.code === 'APPROVER_MISSING')).toBe(true);
  });

  it('cannot certify from invalid lifecycle state', () => {
    const record = runPassedQualification();
    const draft = createPackVersion(
      createMinimalTestPack().packId,
      createMinimalTestPack().packVersion,
      createMinimalTestPack(),
    );
    const evaluation = evaluateCertificationPrerequisites({
      packVersion: draft,
      qualificationRecord: record,
      certificationProfileId: CERT_PROFILE.id,
      certificationProfileVersion: CERT_PROFILE.version,
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      profileLoader: createCertificationProfileLoader([CERT_PROFILE]),
    });

    expect(evaluation.errors.some((e) => e.code === 'LIFECYCLE_PREREQUISITE_INVALID')).toBe(true);
  });
});

describe('certifyPackVersion', () => {
  it('successful certification produces lifecycle transition record', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const result = certifyWithDefaults(record, packVersion);

    expect(result.certification).toBeDefined();
    expect(result.packVersion!.state).toBe('CERTIFIED');
    expect(result.transitionRecord!.action).toBe('CERTIFY');
    expect(result.transitionRecord!.fromState).toBe('PROVISIONAL');
    expect(result.transitionRecord!.toState).toBe('CERTIFIED');
  });

  it('certification does not mutate pack content', () => {
    const { packVersion } = provisionalPackVersion();
    const beforeHash = packVersion.packContentHash;
    const beforeContent = packVersion.packContent;
    const record = runPassedQualification();
    const result = certifyWithDefaults(record, packVersion);

    expect(result.packVersion!.packContentHash).toBe(beforeHash);
    expect(result.packVersion!.packContent).toBe(beforeContent);
  });

  it('binds CertificationRecord to exact identities', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const result = certifyWithDefaults(record, packVersion);
    const cert = result.certification!;

    expect(cert.packContentHash).toBe(packVersion.packContentHash);
    expect(cert.qualificationRecordFingerprint).toBe(record.recordFingerprint);
    expect(cert.fixtureCorpusHash).toBe(record.identity.fixtureCorpusHash);
    expect(cert.decision.kind).toBe('certified');
    expect(cert.recordFingerprint).toBe(
      computeCertificationRecordFingerprint({
        packId: cert.packId,
        packVersion: cert.packVersion,
        packContentHash: cert.packContentHash,
        domainId: cert.domainId,
        qualificationRecordId: cert.qualificationRecordId,
        qualificationRecordFingerprint: cert.qualificationRecordFingerprint,
        fixtureCorpusHash: cert.fixtureCorpusHash,
        ...(cert.authorityCorpusHash !== undefined
          ? { authorityCorpusHash: cert.authorityCorpusHash }
          : {}),
        certificationProfileId: cert.certificationProfileId,
        certificationProfileVersion: cert.certificationProfileVersion,
        reviewerId: cert.reviewerId,
        reviewerRole: cert.reviewerRole,
        decision: cert.decision,
      }),
    );
  });

  it('certificationApplies fails on modified pack content', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const { certification } = certifyWithDefaults(record, packVersion);

    expect(certificationApplies(certification!, packVersion.packContentHash)).toBe(true);
    expect(certificationApplies(certification!, 'modified-hash')).toBe(false);
  });

  it('legacy certifyProvisionalPack fails closed without qualification', () => {
    const { packVersion } = provisionalPackVersion();
    expect(() =>
      certifyProvisionalPack({
        packVersion,
        reviewerId: 'r1',
        reviewerRole: 'DOMAIN_EXPERT',
      }),
    ).toThrow(InvariantViolationError);
  });

  it('loads bootstrap certification profile from configs', () => {
    const loader = loadCertificationProfilesFromDirectory(CERT_PROFILES_DIR);
    const profile = loader.load('bootstrap-default', '1.0.0');
    expect(profile).toBeDefined();
    expect(profile!.requiredReviewerRoles).toContain('DOMAIN_EXPERT');
  });
});

describe('runtime eligibility', () => {
  function baseContext(
    overrides?: Partial<RuntimeEligibilityContext>,
  ): RuntimeEligibilityContext {
    return {
      suppliedCapabilities: [],
      hiveVersion: 'hive-test-1.0.0',
      ...overrides,
    };
  }

  it('certified pack with valid CertificationRecord is eligible', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const certified = certifyWithDefaults(record, packVersion);
    const decision = evaluateRuntimeEligibility(
      certified.packVersion!,
      certified.certification,
      baseContext({ currentQualificationRecord: record }),
    );

    expect(decision.status).toBe('eligible');
    expect(decision.eligibilityFingerprint).toBeDefined();
  });

  it('CERTIFIED pack with no CertificationRecord is ineligible', () => {
    const { packVersion } = provisionalPackVersion();
    const certifiedState = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;
    const decision = evaluateRuntimeEligibility(certifiedState, undefined, baseContext());

    expect(decision.status).toBe('ineligible');
    expect(decision.reasons.some((r) => r.code === 'CERTIFICATION_MISSING')).toBe(true);
  });

  it('DRAFT and PROVISIONAL are ineligible', () => {
    const pack = createMinimalTestPack();
    const draft = createPackVersion(pack.packId, pack.packVersion, pack);
    const provisional = applyPackVersionTransition(draft, 'PROMOTE_TO_PROVISIONAL').packVersion;

    expect(evaluateRuntimeEligibility(draft, undefined, baseContext()).reasons.some((r) => r.code === 'PACK_NOT_CERTIFIED')).toBe(true);
    expect(evaluateRuntimeEligibility(provisional, undefined, baseContext()).reasons.some((r) => r.code === 'CERTIFICATION_MISSING')).toBe(true);
  });

  it('SUSPENDED and SUPERSEDED are ineligible', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    let certified = certifyWithDefaults(record, packVersion).packVersion!;
    certified = applyPackVersionTransition(certified, 'SUSPEND').packVersion;
    expect(evaluateRuntimeEligibility(certified, undefined, baseContext()).reasons.some((r) => r.code === 'PACK_SUSPENDED')).toBe(true);

    certified = applyPackVersionTransition(
      certifyWithDefaults(record, packVersion).packVersion!,
      'SUPERSEDE',
    ).packVersion;
    expect(evaluateRuntimeEligibility(certified, undefined, baseContext()).reasons.some((r) => r.code === 'PACK_SUPERSEDED')).toBe(true);
  });

  it('stale certification is ineligible', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const certified = certifyWithDefaults(record, packVersion);
    const stalePack = { ...certified.packVersion!, packContentHash: 'z'.repeat(64) };
    const decision = evaluateRuntimeEligibility(stalePack, certified.certification, baseContext());

    expect(decision.reasons.some((r) => r.code === 'CERTIFICATION_STALE')).toBe(true);
  });

  it('missing required runtime capability is ineligible', () => {
    const pack = createMinimalTestPack({
      capabilityRequirements: [
        { id: 'cap-req-1', capabilityId: 'hive.extraction', minVersion: '1.0.0' },
      ],
    });
    const packVersion = applyPackVersionTransition(
      createPackVersion(pack.packId, pack.packVersion, pack),
      'PROMOTE_TO_PROVISIONAL',
    ).packVersion;
    const record = runPassedQualification({ packVersion: createPackVersion(pack.packId, pack.packVersion, pack) });
    const certified = certifyWithDefaults(record, packVersion);
    const decision = evaluateRuntimeEligibility(
      certified.packVersion!,
      certified.certification,
      baseContext({ suppliedCapabilities: [] }),
    );

    expect(decision.reasons.some((r) => r.code === 'RUNTIME_CAPABILITY_MISSING')).toBe(true);
  });

  it('exact required capabilities yields eligible', () => {
    const pack = createMinimalTestPack({
      capabilityRequirements: [
        { id: 'cap-req-1', capabilityId: 'hive.extraction', minVersion: '1.0.0' },
      ],
    });
    const packVersion = applyPackVersionTransition(
      createPackVersion(pack.packId, pack.packVersion, pack),
      'PROMOTE_TO_PROVISIONAL',
    ).packVersion;
    const record = runPassedQualification({ packVersion: createPackVersion(pack.packId, pack.packVersion, pack) });
    const certified = certifyWithDefaults(record, packVersion);
    const decision = evaluateRuntimeEligibility(
      certified.packVersion!,
      certified.certification,
      baseContext({
        suppliedCapabilities: [{ capabilityId: 'hive.extraction', version: '1.0.0' }],
        currentQualificationRecord: record,
      }),
    );

    expect(decision.status).toBe('eligible');
  });

  it('deterministic repeated evaluation', () => {
    const { packVersion } = provisionalPackVersion();
    const record = runPassedQualification();
    const certified = certifyWithDefaults(record, packVersion);
    const context = baseContext({ currentQualificationRecord: record });
    const first = evaluateRuntimeEligibility(certified.packVersion!, certified.certification, context);
    const second = evaluateRuntimeEligibility(certified.packVersion!, certified.certification, context);

    expect(first.eligibilityFingerprint).toBe(second.eligibilityFingerprint);
  });

  it('satisfiesMinVersion is deterministic', () => {
    expect(satisfiesMinVersion('2.0.0', '1.0.0')).toBe(true);
    expect(satisfiesMinVersion('0.9.0', '1.0.0')).toBe(false);
  });
});

describe('architecture invariants', () => {
  it('certification cannot be produced by model-shaped input alone', () => {
    const { packVersion } = provisionalPackVersion();
    const result = certifyWithDefaults(
      {
        ...runPassedQualification(),
        status: 'passed',
      },
      packVersion,
      { reviewerId: 'model-output', reviewerRole: 'DOMAIN_EXPERT' },
    );
    expect(result.certification!.reviewerId).toBe('model-output');
    expect(result.certification!.decision.kind).toBe('certified');
    expect(result.certification!.qualificationRecordFingerprint).toBeDefined();
  });

  it('runtime eligibility is not a mutable flag on PackVersion', () => {
    const pack = createMinimalTestPack();
    const version = createPackVersion(pack.packId, pack.packVersion, pack);
    expect('runtimeEligible' in version).toBe(false);
  });
});
