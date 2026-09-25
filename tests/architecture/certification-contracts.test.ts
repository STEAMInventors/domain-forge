import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const CERTIFICATION = join(ROOT, 'packages/certification/src');
const CONTRACTS = join(ROOT, 'packages/contracts/src/certification.ts');

describe('architecture: certification contracts', () => {
  it('CertificationRecord binds beyond packId and version', () => {
    const content = readFileSync(CONTRACTS, 'utf8');
    expect(content).toContain('packContentHash');
    expect(content).toContain('qualificationRecordFingerprint');
    expect(content).toContain('fixtureCorpusHash');
    expect(content).toContain('recordFingerprint');
  });

  it('runtime eligibility is separate from pack lifecycle state', () => {
    const runtime = readFileSync(join(CERTIFICATION, 'runtime-eligibility.ts'), 'utf8');
    expect(runtime).toContain('CERTIFICATION_MISSING');
    expect(runtime).not.toMatch(/runtimeEligible\s*[:=]/);
  });

  it('certification package contains no domain-specific constants', () => {
    const forbidden = ['IEP', 'Medicaid', 'BIP'];
    const files = ['certification-prerequisites.ts', 'runtime-eligibility.ts'];
    for (const file of files) {
      const content = readFileSync(join(CERTIFICATION, file), 'utf8');
      for (const term of forbidden) {
        expect(content).not.toContain(term);
      }
    }
  });

  it('bootstrap certification profile uses exact version', () => {
    const profile = JSON.parse(
      readFileSync(join(ROOT, 'configs/certification/profiles/bootstrap-default-v1.json'), 'utf8'),
    );
    expect(profile.id).toBe('bootstrap-default');
    expect(profile.version).toBe('1.0.0');
    expect(profile.requiredQualificationProfiles[0].version).toBe('1.0.0');
  });
});
