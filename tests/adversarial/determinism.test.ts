import { describe, it, expect } from 'vitest';
import { createMinimalTestPack } from '@domain-forge/testing';
import { createPackRegistries, hashObject } from '@domain-forge/core';
import {
  computePackContentHash,
  composeDomainPack,
  packToDependencyRef,
  minimalDomainPack,
  minimalRule,
  type DomainPackV0,
  type PackResolutionSet,
} from '@hive/pack-contract';
import {
  buildAcceptedFixtureCorpus,
  computeFixtureCorpusHash,
  minimalFixtureCorpus,
} from '@domain-forge/fixtures';
import {
  computeQualificationRecordFingerprint,
} from '@domain-forge/qualification';
import {
  computeCertificationRecordFingerprint,
  evaluateRuntimeEligibility,
  satisfiesMinVersion,
} from '@domain-forge/certification';
import { computeEvidenceReferenceHash } from '@domain-forge/evidence';
import { createPackVersion, applyPackVersionTransition } from '@domain-forge/packs';

function resolutionSet(entries: DomainPackV0[]): PackResolutionSet {
  const map = new Map<string, DomainPackV0>();
  for (const pack of entries) {
    map.set(`${pack.packId}\u0000${pack.packVersion}\u0000${computePackContentHash(pack)}`, pack);
  }
  return map;
}

describe('adversarial: determinism', () => {
  it('pack content hash is stable across repeated computation', () => {
    const pack = createMinimalTestPack();
    const hashes = Array.from({ length: 10 }, () => computePackContentHash(pack));
    expect(new Set(hashes).size).toBe(1);
  });

  it('composition hash is stable across repeated composition', () => {
    const base = minimalDomainPack({ packId: 'base', packVersion: '1.0.0', rules: [minimalRule('r1')] });
    const root = minimalDomainPack({
      dependencies: { extends: [packToDependencyRef(base)], overlay: [], shared: [] },
      rules: [minimalRule('r2')],
    });
    const resolution = resolutionSet([base]);
    const hashes = Array.from({ length: 5 }, () => composeDomainPack(root, resolution).packCompositionHash);
    expect(new Set(hashes).size).toBe(1);
  });

  it('registry fingerprint is stable for identical pack', () => {
    const pack = createMinimalTestPack();
    const fps = Array.from({ length: 5 }, () => createPackRegistries(pack).getFingerprint());
    expect(new Set(fps).size).toBe(1);
  });

  it('fixture corpus hash is stable across repeated computation', () => {
    const corpus = minimalFixtureCorpus();
    const hashes = Array.from({ length: 5 }, () => computeFixtureCorpusHash(corpus));
    expect(new Set(hashes).size).toBe(1);
  });

  it('accepted fixture corpus hash matches direct corpus hash computation', () => {
    const corpus = minimalFixtureCorpus();
    const accepted = buildAcceptedFixtureCorpus(corpus);
    expect(accepted.fixtureCorpusHash).toBe(computeFixtureCorpusHash(corpus));
  });

  it('evidence reference hash is stable for identical input', () => {
    const input = {
      sourceId: 'src-001',
      sourceContentFingerprint: 'a'.repeat(64),
      locator: { kind: 'page' as const, page: 1 },
      quoteVerified: true,
    };
    const h1 = computeEvidenceReferenceHash(input);
    const h2 = computeEvidenceReferenceHash(input);
    expect(h1).toBe(h2);
  });

  it('qualification record fingerprint is stable for identical binding input', () => {
    const fpInput = {
      identity: {
        packId: 'pack-001',
        packContentHash: 'a'.repeat(64),
        fixtureCorpusHash: 'b'.repeat(64),
        qualificationProfileId: 'profile',
        qualificationProfileVersion: '1.0.0',
      },
      status: 'passed' as const,
      fixtureResults: [],
      coverage: {
        syntheticPassed: 1,
        syntheticTotal: 1,
        realCorpusPassed: 0,
        realCorpusTotal: 0,
        incompleteFixtures: 0,
      },
      packValidationResults: [],
      reviewItems: [],
    };
    expect(computeQualificationRecordFingerprint(fpInput)).toBe(
      computeQualificationRecordFingerprint({ ...fpInput }),
    );
  });

  it('certification record fingerprint is stable for identical binding input', () => {
    const input = {
      packId: 'pack-001',
      packVersion: '0.1.0',
      packContentHash: 'a'.repeat(64),
      domainId: 'domain-neutral-test',
      qualificationRecordId: 'qual-001',
      qualificationRecordFingerprint: 'b'.repeat(64),
      fixtureCorpusHash: 'c'.repeat(64),
      certificationProfileId: 'cert-profile',
      certificationProfileVersion: '1.0.0',
      reviewerId: 'reviewer-001',
      reviewerRole: 'DOMAIN_EXPERT',
      decision: { kind: 'certified' as const },
    };
    expect(computeCertificationRecordFingerprint(input)).toBe(
      computeCertificationRecordFingerprint({ ...input }),
    );
  });

  it('runtime eligibility fingerprint is stable for identical context', () => {
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;

    const context = { suppliedCapabilities: [], hiveVersion: 'hive-1.0.0' };
    const d1 = evaluateRuntimeEligibility(packVersion, undefined, context);
    const d2 = evaluateRuntimeEligibility(packVersion, undefined, context);
    expect(d1.status).toBe(d2.status);
    expect(d1.reasons.map((r) => r.code)).toEqual(d2.reasons.map((r) => r.code));
  });

  it('semver capability comparison is deterministic', () => {
    expect(satisfiesMinVersion('1.0.0', '1.0.0')).toBe(satisfiesMinVersion('1.0.0', '1.0.0'));
    expect(satisfiesMinVersion('2.0.0', '1.0.0')).toBe(satisfiesMinVersion('2.0.0', '1.0.0'));
  });

  it('hashObject produces stable output for identical payloads', () => {
    const payload = { a: 1, b: [2, 3], c: { d: 'e' } };
    expect(hashObject(payload)).toBe(hashObject({ ...payload }));
  });
});
