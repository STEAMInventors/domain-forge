import { describe, it, expect } from 'vitest';
import { certifyProvisionalPack, certificationApplies } from './certify.js';
import { createPackVersion, applyPackVersionTransition } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import { InvariantViolationError } from '@domain-forge/core';

describe('certification', () => {
  it('certifies provisional pack with hash binding', () => {
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion('pack-001', '0.1.0', pack);
    packVersion = applyPackVersionTransition(packVersion, 'PROVISIONAL');

    const { certification, packVersion: certified } = certifyProvisionalPack({
      packVersion,
      reviewerId: 'reviewer-001',
      reviewerRole: 'certifying-architect',
    });

    expect(certified.state).toBe('CERTIFIED');
    expect(certification.packContentHash).toBe(packVersion.packContentHash);
  });

  it('rejects certification of non-provisional pack', () => {
    const pack = createMinimalTestPack();
    const packVersion = createPackVersion('pack-001', '0.1.0', pack);

    expect(() =>
      certifyProvisionalPack({
        packVersion,
        reviewerId: 'r1',
        reviewerRole: 'architect',
      }),
    ).toThrow(InvariantViolationError);
  });

  it('certification does not apply to modified pack', () => {
    const pack = createMinimalTestPack();
    const packVersion = applyPackVersionTransition(
      createPackVersion('pack-001', '0.1.0', pack),
      'PROVISIONAL',
    );
    const { certification } = certifyProvisionalPack({
      packVersion,
      reviewerId: 'r1',
      reviewerRole: 'architect',
    });

    expect(certificationApplies(certification, packVersion.packContentHash)).toBe(true);
    expect(certificationApplies(certification, 'modified-hash')).toBe(false);
  });
});
