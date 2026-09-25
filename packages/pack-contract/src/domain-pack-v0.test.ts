import { describe, it, expect } from 'vitest';
import {
  DOMAIN_PACK_SCHEMA_VERSION,
  DomainPackV0Schema,
  PackManifestSchema,
  PackDependencyRefSchema,
  PackIdentitySchema,
  PackVersionStringSchema,
  parseDomainPackV0,
  safeParseDomainPackV0,
  RESERVED_PACK_SECTIONS,
} from './index.js';

const VALID_DEPENDENCY_HASH = 'a'.repeat(64);

function minimalDomainPack() {
  return {
    schemaVersion: DOMAIN_PACK_SCHEMA_VERSION,
    packId: 'pack-neutral-001',
    domainId: 'domain-neutral',
    packVersion: '0.1.0',
    scope: 'synthetic-test-scope',
    jurisdiction: 'TEST-JURISDICTION',
    dependencies: { extends: [], overlay: [], shared: [] },
  };
}

describe('PackIdentitySchema', () => {
  it('accepts valid identity', () => {
    const result = PackIdentitySchema.safeParse({
      packId: 'pack-001',
      domainId: 'domain-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty identifiers', () => {
    const result = PackIdentitySchema.safeParse({ packId: '', domainId: 'domain-001' });
    expect(result.success).toBe(false);
  });
});

describe('PackVersionStringSchema', () => {
  it('accepts semantic versions', () => {
    expect(PackVersionStringSchema.safeParse('1.0.0').success).toBe(true);
    expect(PackVersionStringSchema.safeParse('0.1.0-alpha.1').success).toBe(true);
  });

  it('rejects non-semver strings', () => {
    expect(PackVersionStringSchema.safeParse('v1').success).toBe(false);
    expect(PackVersionStringSchema.safeParse('latest').success).toBe(false);
  });
});

describe('PackDependencyRefSchema', () => {
  it('requires exact packContentHash', () => {
    const result = PackDependencyRefSchema.safeParse({
      packId: 'base-pack',
      packVersion: '1.0.0',
      packContentHash: VALID_DEPENDENCY_HASH,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hash format', () => {
    const result = PackDependencyRefSchema.safeParse({
      packId: 'base-pack',
      packVersion: '1.0.0',
      packContentHash: 'not-a-hash',
    });
    expect(result.success).toBe(false);
  });
});

describe('PackManifestSchema', () => {
  it('validates foundational manifest fields', () => {
    const result = PackManifestSchema.safeParse(minimalDomainPack());
    expect(result.success).toBe(true);
  });

  it('rejects unknown manifest keys', () => {
    const result = PackManifestSchema.safeParse({
      ...minimalDomainPack(),
      forgeRunId: 'run-001',
    });
    expect(result.success).toBe(false);
  });
});

describe('DomainPackV0Schema', () => {
  it('parses a minimal domain-neutral pack shell', () => {
    const pack = parseDomainPackV0(minimalDomainPack());
    expect(pack.schemaVersion).toBe(DOMAIN_PACK_SCHEMA_VERSION);
    expect(pack.rules).toEqual([]);
    expect(pack.composition).toEqual({});
  });

  it('applies default empty reserved sections', () => {
    const parsed = DomainPackV0Schema.parse(minimalDomainPack());
    for (const section of RESERVED_PACK_SECTIONS) {
      if (section === 'composition') {
        expect(parsed.composition).toEqual({});
        continue;
      }
      expect(parsed[section]).toEqual([]);
    }
  });

  it('accepts optional corpusHash metadata', () => {
    const result = safeParseDomainPackV0({
      ...minimalDomainPack(),
      corpusHash: 'corpus-hash-test-001',
    });
    expect(result.success).toBe(true);
  });

  it('accepts dependency declarations', () => {
    const result = safeParseDomainPackV0({
      ...minimalDomainPack(),
      dependencies: {
        extends: [
          {
            packId: 'parent-pack',
            packVersion: '2.0.0',
            packContentHash: VALID_DEPENDENCY_HASH,
          },
        ],
        overlay: [],
        shared: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects unsupported schema versions', () => {
    const result = safeParseDomainPackV0({
      ...minimalDomainPack(),
      schemaVersion: '9.9.9',
    });
    expect(result.success).toBe(false);
  });

  it('rejects reserved section entries without id', () => {
    const result = safeParseDomainPackV0({
      ...minimalDomainPack(),
      rules: [{ id: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects lifecycle fields in pack content', () => {
    const result = safeParseDomainPackV0({
      ...minimalDomainPack(),
      state: 'CERTIFIED',
    });
    expect(result.success).toBe(false);
  });
});
