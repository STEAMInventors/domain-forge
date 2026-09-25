import { describe, it, expect } from 'vitest';
import { GENERIC_PACKAGES, scanPackageForForbiddenTerms, getSourceFiles, REPO_ROOT } from './helpers.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

describe('adversarial: domain-neutrality', () => {
  it.each(GENERIC_PACKAGES)('%s contains no hard-coded domain-specific terms', (pkgPath) => {
    const violations = scanPackageForForbiddenTerms(pkgPath);
    expect(violations).toEqual([]);
  });

  it('CLI service layer contains no domain-specific business logic terms', () => {
    const violations = scanPackageForForbiddenTerms('apps/cli/src');
    expect(violations).toEqual([]);
  });

  it('worker contains no domain-specific business logic terms', () => {
    const violations = scanPackageForForbiddenTerms('apps/worker/src');
    expect(violations).toEqual([]);
  });

  it('orchestration does not embed IEP/Medicaid/bankruptcy concepts', () => {
    const files = getSourceFiles(join(REPO_ROOT, 'packages/orchestration/src'));
    const forbidden = ['IEP', 'Medicaid', 'Chapter 7', 'bankruptcy'];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const term of forbidden) {
        expect(content).not.toContain(term);
      }
    }
  });

  it('validation package remains domain-neutral in source', () => {
    const violations = scanPackageForForbiddenTerms('packages/validation/src');
    expect(violations).toEqual([]);
  });
});
