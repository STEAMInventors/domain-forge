import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  computePackContentHash,
  canonicalizeJson,
  HASH_EXCLUDED_MANIFEST_FIELDS,
  parseDomainPackV0,
} from './index.js';
import { minimalDomainPack, minimalEntity, minimalRule } from './test-helpers.js';

describe('canonicalizeJson', () => {
  it('sorts object keys deterministically', () => {
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalizeJson(Number.NaN)).toThrow(/Non-finite/);
    expect(() => canonicalizeJson(Number.POSITIVE_INFINITY)).toThrow(/Non-finite/);
  });
});

describe('computePackContentHash', () => {
  it('produces same hash for same semantic content', () => {
    const pack = minimalDomainPack();
    const hashA = computePackContentHash(pack);
    const hashB = computePackContentHash({ ...pack });
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable when top-level object properties are reordered', () => {
    const pack = minimalDomainPack({
      rules: [minimalRule('rule-a'), minimalRule('rule-b')],
      entities: [minimalEntity('entity-a')],
    });
    const reordered = {
      entities: [minimalEntity('entity-a')],
      jurisdiction: pack.jurisdiction,
      scope: pack.scope,
      packVersion: pack.packVersion,
      packId: pack.packId,
      domainId: pack.domainId,
      schemaVersion: pack.schemaVersion,
      dependencies: pack.dependencies,
      rules: [minimalRule('rule-a'), minimalRule('rule-b')],
      authorityReferences: [],
      documentTypes: [],
      vocabulary: [],
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

  it('changes hash when meaningful content changes', () => {
    const base = minimalDomainPack();
    const changed = minimalDomainPack({ rules: [minimalRule('rule-changed')] });
    expect(computePackContentHash(changed)).not.toBe(computePackContentHash(base));
  });

  it('excludes description and labels metadata from hash', () => {
    const base = minimalDomainPack();
    const withMetadata = minimalDomainPack({
      description: 'Human-readable only',
      labels: { env: 'test', owner: 'forge' },
    });
    expect(computePackContentHash(withMetadata)).toBe(computePackContentHash(base));
    expect(HASH_EXCLUDED_MANIFEST_FIELDS).toEqual(['description', 'labels']);
  });

  it('includes corpusHash and dependencies in hash', () => {
    const base = minimalDomainPack();
    const withCorpus = minimalDomainPack({ corpusHash: 'corpus-abc' });
    const withDeps = minimalDomainPack({
      dependencies: {
        extends: [
          {
            packId: 'parent-pack',
            packVersion: '1.0.0',
            packContentHash: 'b'.repeat(64),
          },
        ],
        overlay: [],
        shared: [],
      },
    });
    expect(computePackContentHash(withCorpus)).not.toBe(computePackContentHash(base));
    expect(computePackContentHash(withDeps)).not.toBe(computePackContentHash(base));
  });

  it('produces same hash for equivalent YAML and JSON after parsing', () => {
    const yaml = `
schemaVersion: "0.1.0"
packId: pack-yaml-001
domainId: domain-neutral
packVersion: "0.1.0"
scope: synthetic-test-scope
jurisdiction: TEST-JURISDICTION
dependencies:
  extends: []
  overlay: []
  shared: []
rules:
  - id: rule-yaml
    primitive: REQUIRE
description: ignored-for-hash
labels:
  team: qa
`;
    const fromYaml = parseDomainPackV0(parseYaml(yaml));
    const fromJson = parseDomainPackV0({
      schemaVersion: '0.1.0',
      packId: 'pack-yaml-001',
      domainId: 'domain-neutral',
      packVersion: '0.1.0',
      scope: 'synthetic-test-scope',
      jurisdiction: 'TEST-JURISDICTION',
      dependencies: { extends: [], overlay: [], shared: [] },
      rules: [minimalRule('rule-yaml')],
      description: 'different-description',
      labels: { team: 'other' },
    });

    expect(computePackContentHash(fromYaml)).toBe(computePackContentHash(fromJson));
  });
});
