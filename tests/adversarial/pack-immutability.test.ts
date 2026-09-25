import { describe, it, expect } from 'vitest';
import { createPackVersion, applyPackVersionTransition } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import { assertPackContentImmutable } from '@domain-forge/core';
import {
  computePackContentHash,
  composeDomainPack,
  packToDependencyRef,
  parseDomainPackV0,
  safeParseDomainPackV0,
  minimalDomainPack,
  minimalRule,
  type DomainPackV0,
  type PackResolutionSet,
} from '@hive/pack-contract';

function resolutionSet(entries: DomainPackV0[]): PackResolutionSet {
  const map = new Map<string, DomainPackV0>();
  for (const pack of entries) {
    map.set(`${pack.packId}\u0000${pack.packVersion}\u0000${computePackContentHash(pack)}`, pack);
  }
  return map;
}

describe('adversarial: pack immutability', () => {
  it('same content with reordered top-level properties yields identical hash', () => {
    const pack = minimalDomainPack({ rules: [minimalRule('rule-a')] });
    const reordered = {
      rules: pack.rules,
      jurisdiction: pack.jurisdiction,
      scope: pack.scope,
      packVersion: pack.packVersion,
      packId: pack.packId,
      domainId: pack.domainId,
      schemaVersion: pack.schemaVersion,
      dependencies: pack.dependencies,
      authorityReferences: [],
      documentTypes: [],
      vocabulary: [],
      entities: [],
      facts: [],
      composition: {},
      timeModels: [],
      identityStrategies: [],
      questions: [],
      capabilityRequirements: [],
      fixtureReferences: [],
      provenanceReferences: [],
    };
    expect(computePackContentHash(reordered)).toBe(computePackContentHash(pack));
  });

  it('executable rule content mutation changes packContentHash', () => {
    const base = createMinimalTestPack();
    const mutated = createMinimalTestPack({
      rules: [{ ...base.rules[0]!, primitive: 'FORBID' }],
    });
    expect(computePackContentHash(mutated)).not.toBe(computePackContentHash(base));
  });

  it('lifecycle metadata fields are excluded from packContentHash', () => {
    const pack = createMinimalTestPack();
    const withLabels = createMinimalTestPack({
      description: 'Reviewer notes only',
      labels: { reviewer: 'expert-001', certifiedAt: '2099-01-01' },
    });
    expect(computePackContentHash(withLabels)).toBe(computePackContentHash(pack));
  });

  it('lifecycle state transitions do not change packContentHash', () => {
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    const hashBefore = packVersion.packContentHash;
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    expect(packVersion.packContentHash).toBe(hashBefore);
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;
    expect(packVersion.packContentHash).toBe(hashBefore);
  });

  it('qualification and certification metadata do not alter packContentHash', () => {
    const pack = createMinimalTestPack();
    const hash = computePackContentHash(pack);
    const packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    expect(packVersion.packContentHash).toBe(hash);
    expect('qualificationRecordId' in packVersion).toBe(false);
    expect('certificationRecordId' in packVersion).toBe(false);
  });

  it('composed dependency change alters packCompositionHash', () => {
    const shared = minimalDomainPack({
      packId: 'shared-lib',
      packVersion: '1.0.0',
      vocabulary: [{ id: 'term-a' }],
    });
    const rootA = minimalDomainPack({
      dependencies: { extends: [], overlay: [], shared: [packToDependencyRef(shared)] },
    });
    const altShared = minimalDomainPack({
      packId: 'shared-lib-alt',
      packVersion: '1.0.0',
      vocabulary: [{ id: 'term-b' }],
    });
    const rootB = minimalDomainPack({
      dependencies: { extends: [], overlay: [], shared: [packToDependencyRef(altShared)] },
    });

    const hashA = composeDomainPack(rootA, resolutionSet([shared])).packCompositionHash;
    const hashB = composeDomainPack(rootB, resolutionSet([altShared])).packCompositionHash;
    expect(hashA).not.toBe(hashB);
  });

  it('rejects noncanonical pack content with lifecycle fields embedded', () => {
    const pack = createMinimalTestPack();
    const withLifecycle = { ...pack, state: 'CERTIFIED' };
    expect(safeParseDomainPackV0(withLifecycle).success).toBe(false);
  });

  it('rejects noncanonical pack content with unknown top-level keys', () => {
    const pack = createMinimalTestPack();
    const withExtra = { ...pack, runtimeEligible: true };
    expect(safeParseDomainPackV0(withExtra).success).toBe(false);
  });

  it('detects hidden mutable reference mutation after validation snapshot', () => {
    const pack = createMinimalTestPack();
    const hash = computePackContentHash(pack);
    const before = { packContent: structuredClone(pack), packContentHash: hash };
    const tamperedContent = structuredClone(pack);
    tamperedContent.rules[0] = { ...tamperedContent.rules[0]!, id: 'rule-tampered' };

    expect(() =>
      assertPackContentImmutable(before, {
        packContent: tamperedContent,
        packContentHash: hash,
      }),
    ).toThrow();
  });

  it('parseDomainPackV0 fails closed on unsupported schema version injection', () => {
    const pack = createMinimalTestPack();
    expect(() => parseDomainPackV0({ ...pack, schemaVersion: '99.99.99' })).toThrow();
  });
});
