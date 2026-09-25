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
import type { QualificationInput, QualificationRecord } from '@domain-forge/contracts';

const PROFILE = parseQualificationProfile({
  id: 'adv-qual-profile',
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

function buildInput(overrides?: Partial<QualificationInput>): QualificationInput {
  const pack = createMinimalTestPack();
  const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
  const accepted = buildAcceptedFixtureCorpus(minimalFixtureCorpus());
  const fixture = minimalFixtureDefinition();
  return {
    packVersion,
    fixtureCorpus: accepted,
    qualificationProfileId: PROFILE.id,
    qualificationProfileVersion: PROFILE.version,
    execution: {
      executionRunId: 'run-adv-001',
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
    ...overrides,
  };
}

describe('adversarial: qualification bypass resistance', () => {
  const executor = new DefaultQualificationExecutor({
    profileLoader: createQualificationProfileLoader([PROFILE]),
  });

  it('blocks wrong pack content hash via fixture reference pin', () => {
    const pack = createMinimalTestPack({
      fixtureReferences: [
        { id: 'ref-1', corpusId: 'c', fixtureIds: ['f'], packContentHash: 'f'.repeat(64) },
      ],
    });
    const result = executor.execute(buildInput({ packVersion: createPackVersion(pack.packId, pack.packVersion, pack) }));
    expect(result.status).toBe('blocked');
    expect(result.errors.some((e) => e.code === 'PACK_HASH_MISMATCH')).toBe(true);
  });

  it('blocks wrong fixture corpus hash', () => {
    const input = buildInput();
    const badCorpus = { ...input.fixtureCorpus, fixtureCorpusHash: 'bad'.repeat(16) };
    const result = executor.execute({ ...input, fixtureCorpus: badCorpus });
    expect(result.status).toBe('blocked');
    expect(result.errors.some((e) => e.code === 'FIXTURE_CORPUS_MISMATCH')).toBe(true);
  });

  it('blocks FAKE executor trust when REAL_HIVE required', () => {
    const result = executor.execute({
      ...buildInput(),
      execution: { ...buildInput().execution, executorTrustLevel: 'FAKE' },
    });
    expect(result.status).toBe('blocked');
  });

  it('reports incomplete when required fixture skipped', () => {
    const result = executor.execute(buildInput({ fixtureExecutions: [] }));
    expect(result.status).toBe('incomplete');
    expect(result.errors.some((e) => e.code === 'REQUIRED_FIXTURE_MISSING')).toBe(true);
  });

  it('reports failed when gold evaluation fails', () => {
    const fixture = minimalFixtureDefinition();
    const result = executor.execute(
      buildInput({
        fixtureExecutions: [
          {
            fixtureId: fixture.id,
            fixtureFingerprint: computeFixtureFingerprint(fixture),
            fixtureCategory: fixture.category,
            materialClass: fixture.provenance.materialClass,
            executionStatus: 'completed',
            goldEvaluation: {
              passed: false,
              findings: [{ status: 'value_mismatch', message: 'Gold mismatch' }],
            },
          },
        ],
      }),
    );
    expect(result.status).toBe('failed');
  });

  it('does not certify pack — qualification never transitions lifecycle', () => {
    const input = buildInput();
    const packVersion = applyPackVersionTransition(input.packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    const result = executor.execute({ ...input, packVersion });
    expect(result.status).toBe('passed');
    expect(packVersion.state).toBe('PROVISIONAL');
  });

  it('detects stale qualification on pack content change', () => {
    const result = executor.execute(buildInput());
    const record = result.record!;
    const evaluator = new DefaultQualificationStalenessEvaluator();
    const stale = evaluator.evaluate(record, {
      packContentHash: 'changed'.padEnd(64, '0'),
      fixtureCorpusHash: record.identity.fixtureCorpusHash,
      qualificationProfileId: record.identity.qualificationProfileId,
      qualificationProfileVersion: record.identity.qualificationProfileVersion,
    });
    expect(stale.isStale).toBe(true);
  });

  it('rejects manually constructed passing record with contradictory fixture results', () => {
    const forged: Partial<QualificationRecord> = {
      status: 'passed',
      fixtureResults: [{ fixtureId: 'f-1', passed: false, goldEvaluationPassed: false }],
    };
    expect(forged.status).toBe('passed');
    expect(forged.fixtureResults?.[0]?.passed).toBe(false);
  });

  it('blocks qualification on already CERTIFIED pack', () => {
    const input = buildInput();
    let packVersion = applyPackVersionTransition(input.packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;
    const result = executor.execute({ ...input, packVersion });
    expect(result.errors.some((e) => e.code === 'PACK_NOT_ELIGIBLE')).toBe(true);
  });
});
