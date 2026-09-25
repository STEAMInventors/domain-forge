import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createPackVersion } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import {
  buildAcceptedFixtureCorpus,
  computeFixtureCorpusHash,
  computeFixtureFingerprint,
  evaluateGoldExpectations,
} from '@domain-forge/fixtures';
import { minimalFixtureCorpus, minimalFixtureDefinition } from '@domain-forge/fixtures';
import type {
  FixtureExecutionResult,
  QualificationInput,
  QualificationRecord,
} from '@domain-forge/contracts';
import {
  createQualificationProfileLoader,
  parseQualificationProfile,
} from './qualification-profile.js';
import { DefaultQualificationExecutor } from './qualification-executor.js';
import { DefaultQualificationStalenessEvaluator } from './qualification-staleness.js';
import { computeQualificationRecordFingerprint } from './qualification-fingerprint.js';
import { loadQualificationProfilesFromDirectory } from './config-loader.js';
import { applyPackVersionTransition } from '@domain-forge/packs';

const ROOT = join(import.meta.dirname, '../../..');
const PROFILES_DIR = join(ROOT, 'configs/qualification/profiles');

const DEFAULT_PROFILE = parseQualificationProfile({
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
  coverageRequirements: {
    minSyntheticFixtures: 1,
    requireAllPackFixtureReferences: true,
  },
  layerARequired: true,
  layerBRequired: false,
  requiredExecutionTrust: 'REAL_HIVE',
  allowedPackVersionStates: ['DRAFT', 'PROVISIONAL'],
});

function buildExecutionInput(overrides?: Partial<QualificationInput>): QualificationInput {
  const pack = createMinimalTestPack();
  const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  const corpus = minimalFixtureCorpus();
  const accepted = buildAcceptedFixtureCorpus(corpus);
  const fixture = minimalFixtureDefinition();

  const goldEvaluation = evaluateGoldExpectations(
    {
      extractions: [],
      ruleOutcomes: [],
      claims: [],
      narratives: [],
    },
    corpus,
  );

  const defaultExecutions: FixtureExecutionResult[] = [
    {
      fixtureId: fixture.id,
      fixtureFingerprint: computeFixtureFingerprint(fixture),
      fixtureCategory: fixture.category,
      materialClass: fixture.provenance.materialClass,
      executionStatus: 'completed',
      goldEvaluation,
    },
  ];

  const { fixtureExecutions: overrideExecutions, ...restOverrides } = overrides ?? {};

  return {
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: DEFAULT_PROFILE.id,
    qualificationProfileVersion: DEFAULT_PROFILE.version,
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

function createExecutor(profile = DEFAULT_PROFILE) {
  return new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([profile]),
  });
}

describe('QualificationRecord', () => {
  it('builds valid record with exact pack identity binding', () => {
    const input = buildExecutionInput();
    const result = createExecutor().execute(input);

    expect(result.record).toBeDefined();
    expect(result.record!.identity.packContentHash).toBe(input.packVersion.packContentHash);
    expect(result.record!.identity.packId).toBe(input.packVersion.packId);
    expect(result.record!.identity.fixtureCorpusHash).toBe(
      input.fixtureCorpus.fixtureCorpusHash,
    );
  });

  it('detects pack hash mismatch via fixture reference pin', () => {
    const pack = createMinimalTestPack({
      fixtureReferences: [
        {
          id: 'fix-ref-001',
          corpusId: 'corpus-test-001',
          fixtureIds: ['fixture-001'],
          packContentHash: 'f'.repeat(64),
        },
      ],
    });
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    const input = buildExecutionInput({ packVersion });
    const result = createExecutor().execute(input);

    expect(result.errors.some((e) => e.code === 'PACK_HASH_MISMATCH')).toBe(true);
    expect(result.status).toBe('blocked');
  });

  it('detects fixture corpus hash mismatch', () => {
    const input = buildExecutionInput();
    const badCorpus = {
      ...input.fixtureCorpus,
      fixtureCorpusHash: 'b'.repeat(64),
    };
    const result = createExecutor().execute({ ...input, fixtureCorpus: badCorpus });

    expect(result.errors.some((e) => e.code === 'FIXTURE_CORPUS_MISMATCH')).toBe(true);
    expect(result.status).toBe('blocked');
  });

  it('binds authority corpus hash separately from fixture corpus hash', () => {
    const pack = createMinimalTestPack({ corpusHash: 'authority-corpus-abc' });
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    const input = buildExecutionInput({ packVersion });
    const result = createExecutor().execute(input);

    expect(result.record!.identity.authorityCorpusHash).toBe('authority-corpus-abc');
    expect(result.record!.identity.fixtureCorpusHash).not.toBe('authority-corpus-abc');
  });

  it('binds qualification profile version', () => {
    const input = buildExecutionInput();
    const result = createExecutor().execute(input);

    expect(result.record!.identity.qualificationProfileId).toBe('test-profile');
    expect(result.record!.identity.qualificationProfileVersion).toBe('1.0.0');
  });

  it('reports missing required fixture', () => {
    const input = buildExecutionInput({ fixtureExecutions: [] });
    const result = createExecutor().execute(input);

    expect(result.errors.some((e) => e.code === 'REQUIRED_FIXTURE_MISSING')).toBe(true);
    expect(result.status).toBe('incomplete');
  });

  it('accounts for synthetic vs real-corpus material classes', () => {
    const syntheticFixture = minimalFixtureDefinition({
      id: 'fixture-synthetic',
      category: 'synthetic',
      provenance: { materialClass: 'synthetic' },
    });
    const realFixture = minimalFixtureDefinition({
      id: 'fixture-real',
      category: 'real_corpus',
      provenance: { materialClass: 'real_corpus' },
    });
    const corpus = minimalFixtureCorpus({
      standaloneFixtures: [syntheticFixture, realFixture],
    });
    const accepted = buildAcceptedFixtureCorpus(corpus);

    const executions: FixtureExecutionResult[] = [
      {
        fixtureId: syntheticFixture.id,
        fixtureFingerprint: computeFixtureFingerprint(syntheticFixture),
        fixtureCategory: syntheticFixture.category,
        materialClass: 'synthetic',
        executionStatus: 'completed',
        goldEvaluation: { passed: true, findings: [] },
      },
      {
        fixtureId: realFixture.id,
        fixtureFingerprint: computeFixtureFingerprint(realFixture),
        fixtureCategory: realFixture.category,
        materialClass: 'real_corpus',
        executionStatus: 'completed',
        goldEvaluation: { passed: true, findings: [] },
      },
    ];

    const input = buildExecutionInput({
      fixtureCorpus: accepted,
      fixtureExecutions: executions,
    });
    const result = createExecutor().execute(input);

    expect(result.record!.coverage.syntheticTotal).toBe(1);
    expect(result.record!.coverage.realCorpusTotal).toBe(1);
    expect(result.record!.coverage.syntheticPassed).toBe(1);
    expect(result.record!.coverage.realCorpusPassed).toBe(1);
  });

  it('propagates gold evaluator forbidden artifacts', () => {
    const input = buildExecutionInput({
      fixtureExecutions: [
        {
          fixtureId: 'fixture-001',
          fixtureFingerprint: 'a'.repeat(64),
          fixtureCategory: 'synthetic',
          materialClass: 'synthetic',
          executionStatus: 'completed',
          goldEvaluation: {
            passed: false,
            findings: [
              {
                status: 'forbidden_artifact_produced',
                message: 'Forbidden claim produced',
                forbiddenKind: 'claim',
              },
            ],
          },
        },
      ],
    });
    const result = createExecutor().execute(input);

    expect(result.record!.fixtureResults[0]?.forbiddenArtifacts?.length).toBe(1);
    expect(result.status).toBe('failed');
  });

  it('handles incomplete fixture execution', () => {
    const input = buildExecutionInput({
      fixtureExecutions: [
        {
          fixtureId: 'fixture-001',
          fixtureFingerprint: 'a'.repeat(64),
          fixtureCategory: 'synthetic',
          materialClass: 'synthetic',
          executionStatus: 'incomplete',
          runtimeFailure: { code: 'STAGE_FAILURE', message: 'Stage did not complete' },
        },
      ],
    });
    const result = createExecutor().execute(input);

    expect(result.status).toBe('incomplete');
    expect(result.record!.coverage.incompleteFixtures).toBe(1);
  });

  it('includes completeness validators in pack validation results', () => {
    const input = buildExecutionInput();
    const result = createExecutor().execute(input);

    const validatorIds = result.record!.packValidationResults.map((v) => v.validatorId);
    expect(validatorIds).toContain('extraction-contract-completeness');
    expect(validatorIds).toContain('output-specification-completeness');
  });

  it('enforces lifecycle prerequisite without certifying pack', () => {
    const input = buildExecutionInput();
    let packVersion = applyPackVersionTransition(input.packVersion, 'PROMOTE_TO_PROVISIONAL')
      .packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;

    const result = createExecutor().execute({ ...input, packVersion });
    expect(result.errors.some((e) => e.code === 'PACK_NOT_ELIGIBLE')).toBe(true);
    expect(packVersion.state).toBe('CERTIFIED');
  });

  it('does not transition pack to CERTIFIED', () => {
    const input = buildExecutionInput();
    const beforeState = input.packVersion.state;
    createExecutor().execute(input);
    expect(input.packVersion.state).toBe(beforeState);
    expect(input.packVersion.state).not.toBe('CERTIFIED');
  });

  it('detects staleness on pack content change', () => {
    const input = buildExecutionInput();
    const result = createExecutor().execute(input);
    const record = result.record!;

    const evaluator = new DefaultQualificationStalenessEvaluator();
    const evaluation = evaluator.evaluate(record, {
      packContentHash: 'c'.repeat(64),
      fixtureCorpusHash: record.identity.fixtureCorpusHash,
      qualificationProfileId: record.identity.qualificationProfileId,
      qualificationProfileVersion: record.identity.qualificationProfileVersion,
    });

    expect(evaluation.isStale).toBe(true);
    expect(evaluation.reasons).toContain('PACK_CONTENT_HASH_CHANGED');
  });

  it('detects staleness on fixture corpus change', () => {
    const input = buildExecutionInput();
    const record = createExecutor().execute(input).record!;

    const evaluator = new DefaultQualificationStalenessEvaluator();
    const evaluation = evaluator.evaluate(record, {
      packContentHash: record.identity.packContentHash,
      fixtureCorpusHash: 'd'.repeat(64),
      qualificationProfileId: record.identity.qualificationProfileId,
      qualificationProfileVersion: record.identity.qualificationProfileVersion,
    });

    expect(evaluation.reasons).toContain('FIXTURE_CORPUS_HASH_CHANGED');
  });

  it('detects staleness on qualification profile change', () => {
    const input = buildExecutionInput();
    const record = createExecutor().execute(input).record!;

    const evaluator = new DefaultQualificationStalenessEvaluator();
    const evaluation = evaluator.evaluate(record, {
      packContentHash: record.identity.packContentHash,
      fixtureCorpusHash: record.identity.fixtureCorpusHash,
      qualificationProfileId: record.identity.qualificationProfileId,
      qualificationProfileVersion: '2.0.0',
    });

    expect(evaluation.reasons).toContain('QUALIFICATION_PROFILE_VERSION_CHANGED');
  });

  it('does not stale on non-content metadata changes', () => {
    const input = buildExecutionInput();
    const record = createExecutor().execute(input).record!;

    const evaluator = new DefaultQualificationStalenessEvaluator();
    const current = {
      packContentHash: record.identity.packContentHash,
      fixtureCorpusHash: record.identity.fixtureCorpusHash,
      qualificationProfileId: record.identity.qualificationProfileId,
      qualificationProfileVersion: record.identity.qualificationProfileVersion,
      ...(record.identity.authorityCorpusHash !== undefined
        ? { authorityCorpusHash: record.identity.authorityCorpusHash }
        : {}),
    };
    const evaluation = evaluator.evaluate(record, current);

    expect(evaluation.isStale).toBe(false);
  });

  it('produces deterministic qualification fingerprint', () => {
    const input = buildExecutionInput();
    const first = createExecutor().execute(input).record!;
    const second = createExecutor().execute(input).record!;

    expect(first.recordFingerprint).toBe(second.recordFingerprint);
    expect(first.recordFingerprint).toBe(
      computeQualificationRecordFingerprint({
        identity: first.identity,
        status: first.status,
        ...(first.ruleQualification !== undefined
          ? { ruleQualification: first.ruleQualification }
          : {}),
        ...(first.extractionQualification !== undefined
          ? { extractionQualification: first.extractionQualification }
          : {}),
        fixtureResults: first.fixtureResults,
        coverage: first.coverage,
        packValidationResults: first.packValidationResults,
        reviewItems: first.reviewItems,
      }),
    );
  });

  it('rejects untrusted executor (FakeHive cannot qualify)', () => {
    const input = buildExecutionInput({
      execution: {
        executionRunId: 'run-fake',
        executorTrustLevel: 'FAKE',
        hiveVersion: 'hive-fake',
        executorVersion: 'fake-1',
        layerAMode: 'FACTS_IN',
      },
    });
    const result = createExecutor().execute(input);

    expect(result.status).toBe('blocked');
  });

  it('rejects model-proposed fixture corpus', () => {
    const input = buildExecutionInput({
      fixtureCorpus: {
        source: 'MODEL',
        proposalId: 'prop-001',
        domainId: 'domain-neutral-test',
        fixtures: [],
      } as unknown as QualificationInput['fixtureCorpus'],
    });
    const result = createExecutor().execute(input);

    expect(result.errors.some((e) => e.code === 'FIXTURE_NOT_APPROVED')).toBe(true);
  });

  it('loads bootstrap profile from configs/qualification', () => {
    const loader = loadQualificationProfilesFromDirectory(PROFILES_DIR);
    const profile = loader.load('bootstrap-default', '1.0.0');
    expect(profile).toBeDefined();
    expect(profile!.requiredExecutionTrust).toBe('REAL_HIVE');
  });

  it('resolves reviewer role from registry when review is required', () => {
    const profile = parseQualificationProfile({
      ...DEFAULT_PROFILE,
      humanReviewRequirements: [
        { reviewerRole: 'DOMAIN_EXPERT', requiredForCategories: ['adversarial'] },
      ],
    });
    const adversarial = minimalFixtureDefinition({
      id: 'fixture-001',
      category: 'adversarial',
    });
    const corpus = minimalFixtureCorpus({ standaloneFixtures: [adversarial] });
    const input = buildExecutionInput({
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
            findings: [{ status: 'mismatch', message: 'Needs expert review' }],
          },
        },
      ],
    });

    const result = new DefaultQualificationExecutor({
      profileLoader: createQualificationProfileLoader([profile]),
    }).execute(input);

    expect(result.status).toBe('requires_review');
    expect(result.record!.reviewItems.some((r) => r.reviewerRole === 'DOMAIN_EXPERT')).toBe(
      true,
    );
  });

  it('rejects unknown reviewer role', () => {
    const profile = {
      ...DEFAULT_PROFILE,
      humanReviewRequirements: [{ reviewerRole: 'NOT_A_REAL_ROLE' }],
    } as unknown as typeof DEFAULT_PROFILE;
    const result = new DefaultQualificationExecutor({
      profileLoader: createQualificationProfileLoader([profile]),
    }).execute(buildExecutionInput());

    expect(result.errors.some((e) => e.code === 'UNRESOLVED_REVIEWER_ROLE')).toBe(true);
  });

  it('validates pack fixture reference corpus binding', () => {
    const pack = createMinimalTestPack({
      fixtureReferences: [
        {
          id: 'fix-ref-001',
          corpusId: 'wrong-corpus',
          fixtureIds: ['fixture-001'],
          fixtureCorpusHash: computeFixtureCorpusHash(minimalFixtureCorpus()),
        },
      ],
    });
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    const result = createExecutor().execute(buildExecutionInput({ packVersion }));

    expect(result.errors.some((e) => e.code === 'FIXTURE_REFERENCE_MISMATCH')).toBe(true);
  });

  it('record is immutable evidence — new execution yields new fingerprint when results differ', () => {
    const passingExecution: FixtureExecutionResult = {
      fixtureId: 'fixture-001',
      fixtureFingerprint: 'a'.repeat(64),
      fixtureCategory: 'synthetic',
      materialClass: 'synthetic',
      executionStatus: 'completed',
      goldEvaluation: { passed: true, findings: [{ status: 'match', message: 'ok' }] },
    };
    const failingExecution: FixtureExecutionResult = {
      ...passingExecution,
      goldEvaluation: { passed: false, findings: [{ status: 'mismatch', message: 'fail' }] },
    };

    const passed = createExecutor().execute(
      buildExecutionInput({ fixtureExecutions: [passingExecution] }),
    ).record as QualificationRecord;
    const failed = createExecutor().execute(
      buildExecutionInput({ fixtureExecutions: [failingExecution] }),
    ).record as QualificationRecord;

    expect(passed.recordFingerprint).not.toBe(failed.recordFingerprint);
    expect(passed.status).toBe('passed');
    expect(failed.status).toBe('failed');
  });

  it('PackVersion uses authorityCorpusHash without empty-string fallback', () => {
    const packWithCorpus = createMinimalTestPack();
    const packWithoutCorpus = { ...packWithCorpus };
    delete (packWithoutCorpus as { corpusHash?: string }).corpusHash;
    const version = createPackVersion(
      packWithoutCorpus.packId,
      packWithoutCorpus.packVersion,
      packWithoutCorpus,
    );
    expect(version.authorityCorpusHash).toBeUndefined();
    expect('corpusHash' in version).toBe(false);
  });
});
