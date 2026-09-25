import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSourceFiles, REPO_ROOT } from './helpers.js';

const FORGE_PACKAGES = [
  '@domain-forge/core',
  '@domain-forge/contracts',
  '@domain-forge/validation',
  '@domain-forge/evidence',
  '@domain-forge/sources',
  '@domain-forge/qualification',
  '@domain-forge/certification',
  '@domain-forge/persistence',
  '@domain-forge/orchestration',
  '@domain-forge/packs',
  '@domain-forge/fixtures',
];

describe('adversarial: architecture dependency direction', () => {
  it('@hive/pack-contract must not import any @domain-forge package', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'packages/pack-contract/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@domain-forge\//);
    }
  });

  it('@hive/pack-contract must not reference Forge orchestration concepts', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'packages/pack-contract/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/ForgeRun|ForgeStage|StageAttempt|QualificationRecord|CertificationRecord/);
    }
  });

  it('core must not depend on orchestration or persistence', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'packages/core/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@domain-forge\/(orchestration|persistence|qualification|certification)/);
    }
  });

  it('persistence must not own certification decision logic imports', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'packages/persistence/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/certifyPackVersion|evaluateCertificationPrerequisites/);
    }
  });

  it('CLI must not become a domain-logic package', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'apps/cli/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const pkg of FORGE_PACKAGES.filter((p) => p.includes('pack-contract'))) {
        expect(content).not.toContain(pkg);
      }
    }
  });

  it('contracts package must not import operational runtime packages', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'packages/contracts/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@domain-forge\/(orchestration|persistence|validation|sources)/);
    }
  });

  it.each(['packages/validation/src', 'packages/evidence/src', 'packages/sources/src'])(
    '%s does not import orchestration',
    (pkgPath) => {
      const files = getSourceFiles(join(REPO_ROOT, pkgPath));
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toMatch(/@domain-forge\/orchestration/);
      }
    },
  );
});
