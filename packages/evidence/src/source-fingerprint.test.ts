import { describe, it, expect } from 'vitest';
import { asSourceId } from '@domain-forge/core';
import {
  computeExcerptHash,
  computeNormalizedTextFingerprint,
  computeRawContentFingerprint,
  computeSourceIdentityHash,
} from './source-fingerprint.js';
import { computePackContentHash } from '@hive/pack-contract';
import { createMinimalTestPack } from '@domain-forge/testing';

describe('source fingerprinting', () => {
  it('hashes raw content distinctly from pack content hash', () => {
    const raw = 'raw source bytes';
    const fingerprint = computeRawContentFingerprint(raw);
    const packHash = computePackContentHash(createMinimalTestPack());
    expect(fingerprint.hash).not.toBe(packHash);
    expect(fingerprint.representation).toBe('raw_content');
  });

  it('produces stable normalized text fingerprint', () => {
    const fp = computeNormalizedTextFingerprint('hello world', {
      normalizationVersion: '0.1.0',
      extractionVersion: '0.1.0',
    });
    expect(fp.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      computeNormalizedTextFingerprint('hello world', {
        normalizationVersion: '0.1.0',
        extractionVersion: '0.1.0',
      }).hash,
    ).toBe(fp.hash);
  });

  it('hashes excerpt text for integrity checking', () => {
    expect(computeExcerptHash('exact quote')).toBe(computeExcerptHash('exact quote'));
    expect(computeExcerptHash('exact quote')).not.toBe(computeExcerptHash('different quote'));
  });

  it('source identity hash excludes retrieval metadata', () => {
    const base = {
      sourceId: asSourceId('src-1'),
      sourceType: 'file' as const,
      locator: { kind: 'file' as const, path: '/data/doc.pdf' },
      contentFingerprint: computeRawContentFingerprint('content'),
    };
    expect(computeSourceIdentityHash(base)).toBe(computeSourceIdentityHash(base));
  });
});
