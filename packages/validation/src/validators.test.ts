import { describe, it, expect } from 'vitest';
import {
  StageIndependenceValidator,
  ProvisionalReadinessValidator,
  CertificationValidator,
  PrimitiveValidator,
  validatePack,
  allPassed,
} from './validators.js';
import { createMinimalTestPack } from '@domain-forge/testing';
import { computePackContentHash } from '@hive/pack-contract';

describe('validators', () => {
  it('enforces stage 7 independence', () => {
    const v = new StageIndependenceValidator();
    expect(v.validate({ stage6ModelIdentity: 'a:model1', stage7ModelIdentity: 'b:model2' }).passed).toBe(true);
    expect(v.validate({ stage6ModelIdentity: 'a:model1', stage7ModelIdentity: 'a:model1' }).passed).toBe(false);
  });

  it('evaluates provisional readiness', () => {
    const v = new ProvisionalReadinessValidator();
    const allTrue = {
      stage0Approved: true,
      allStagesCompleted: true,
      schemaValid: true,
      semanticValid: true,
      evidenceValid: true,
      quotesVerified: true,
      referencesResolved: true,
      primitivesValid: true,
      structuresValid: true,
      noOpenGaps: true,
      adversarialClear: true,
      fixturesExist: true,
      fixturesMatch: true,
      fixtureCoverageMet: true,
      budgetOk: true,
      noBlockingHumanReview: true,
      packContentHashFrozen: true,
    };
    expect(v.validate(allTrue).passed).toBe(true);
    expect(v.validate({ ...allTrue, stage0Approved: false }).passed).toBe(false);
  });

  it('binds certification to pack hash', () => {
    const pack = createMinimalTestPack();
    const hash = computePackContentHash(pack);
    const v = new CertificationValidator();
    expect(v.validate({ packContentHash: hash, certificationHash: hash, decision: 'CERTIFIED' }).passed).toBe(true);
    expect(v.validate({ packContentHash: hash, certificationHash: 'different', decision: 'CERTIFIED' }).passed).toBe(false);
  });

  it('validates pack primitives', () => {
    const pack = createMinimalTestPack();
    const results = validatePack(pack);
    expect(allPassed(results)).toBe(true);

    const badPack = createMinimalTestPack({
      rules: [
        {
          id: 'r1',
          name: 'Bad',
          trigger: 't',
          primitive: 'INVENTED',
          entityIds: [],
          factIds: [],
          exceptions: [],
          authorityRefIds: ['auth-001'],
        },
      ],
    });
    const badResults = new PrimitiveValidator().validate(badPack);
    expect(badResults.passed).toBe(false);
  });
});
