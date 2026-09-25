import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import type { SourceIdentity, SourceRecord } from '@domain-forge/contracts';
import { validateSourceIdentity, validateSourceRecord } from './source-validation.js';
import { computeSourceIdentityHash } from './source-fingerprint.js';

function validIdentity(overrides: Partial<SourceIdentity> = {}): SourceIdentity {
  return {
    sourceId: asSourceId('src-abc123'),
    sourceType: 'web_snapshot',
    title: 'Example Source',
    locator: { kind: 'url', url: 'https://example.org/doc' },
    contentFingerprint: {
      algorithm: 'sha256',
      hash: 'a'.repeat(64),
      representation: 'normalized_text',
      normalizationVersion: '0.1.0',
      extractionVersion: '0.1.0',
    },
    ...overrides,
  };
}

describe('validateSourceIdentity', () => {
  it('accepts valid source identity', () => {
    expect(validateSourceIdentity(validIdentity()).valid).toBe(true);
  });

  it('rejects malformed source type', () => {
    const result = validateSourceIdentity(validIdentity({ sourceType: 'invalid' as never }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('EVIDENCE_REFERENCE_INVALID');
  });

  it('rejects invalid fingerprint hash', () => {
    const result = validateSourceIdentity(
      validIdentity({
        contentFingerprint: {
          algorithm: 'sha256',
          hash: 'not-a-hash',
          representation: 'normalized_text',
          normalizationVersion: '0.1.0',
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'contentFingerprint.hash')).toBe(true);
  });

  it('requires normalizationVersion for normalized_text fingerprints', () => {
    const result = validateSourceIdentity(
      validIdentity({
        contentFingerprint: {
          algorithm: 'sha256',
          hash: 'b'.repeat(64),
          representation: 'normalized_text',
        },
      }),
    );
    expect(result.valid).toBe(false);
  });

  it('produces stable source identity hash', () => {
    const identity = validIdentity();
    expect(computeSourceIdentityHash(identity)).toBe(computeSourceIdentityHash(identity));
  });
});

describe('validateSourceRecord', () => {
  it('rejects self-supersession', () => {
    const identity = validIdentity();
    const record: SourceRecord = {
      identity,
      authority: { authorityCategory: 'primary', supersededBySourceId: identity.sourceId },
    };
    const result = validateSourceRecord(record);
    expect(result.valid).toBe(false);
  });
});
