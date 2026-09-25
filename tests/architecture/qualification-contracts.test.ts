import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const QUALIFICATION_PKG = join(ROOT, 'packages/qualification/src');
const CONTRACTS = join(ROOT, 'packages/contracts/src/qualification.ts');
const CERTIFICATION = join(ROOT, 'packages/certification/src');

describe('architecture: qualification contracts', () => {
  it('qualification package does not implement certification transitions', () => {
    const executor = readFileSync(join(QUALIFICATION_PKG, 'qualification-executor.ts'), 'utf8');
    expect(executor).not.toMatch(/CERTIFY|Runtime Eligibility|certifyProvisionalPack/);
    expect(executor).not.toMatch(/applyPackVersionTransition/);
  });

  it('qualification contracts distinguish fixture corpus from authority corpus', () => {
    const content = readFileSync(CONTRACTS, 'utf8');
    expect(content).toContain('authorityCorpusHash');
    expect(content).toContain('fixtureCorpusHash');
  });

  it('qualification package contains no domain-specific constants', () => {
    const forbidden = ['IEP', 'Medicaid', 'BIP'];
    const files = ['qualification-executor.ts', 'qualification-coverage.ts'];
    for (const file of files) {
      const content = readFileSync(join(QUALIFICATION_PKG, file), 'utf8');
      for (const term of forbidden) {
        expect(content).not.toContain(term);
      }
    }
  });

  it('certification package does not execute qualification', () => {
    const files = ['certify.ts', 'certification-prerequisites.ts'];
    for (const file of files) {
      const content = readFileSync(join(CERTIFICATION, file), 'utf8');
      expect(content).not.toMatch(/DefaultQualificationExecutor/);
    }
  });

  it('certification validates qualification evidence without collapsing concepts', () => {
    const prerequisites = readFileSync(
      join(CERTIFICATION, 'certification-prerequisites.ts'),
      'utf8',
    );
    expect(prerequisites).toContain('QualificationRecord');
    expect(prerequisites).toContain('canCertify');
  });

  it('configs/qualification profile exists with exact version', () => {
    const profile = JSON.parse(
      readFileSync(join(ROOT, 'configs/qualification/profiles/bootstrap-default-v1.json'), 'utf8'),
    );
    expect(profile.id).toBe('bootstrap-default');
    expect(profile.version).toBe('1.0.0');
    expect(profile.requiredExecutionTrust).toBe('REAL_HIVE');
  });
});
