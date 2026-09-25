import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const REPO_ROOT = join(import.meta.dirname, '../..');

/** Domain-specific terms that must not appear in generic Forge packages. */
export const FORBIDDEN_DOMAIN_TERMS = [
  'IEP',
  'Individualized Education Program',
  'BIP',
  'Medicaid',
  'Chapter 7',
  'bankruptcy',
  '504 Plan',
] as const;

/** Generic packages that must remain domain-neutral. */
export const GENERIC_PACKAGES = [
  'packages/core/src',
  'packages/contracts/src',
  'packages/validation/src',
  'packages/evidence/src',
  'packages/sources/src',
  'packages/qualification/src',
  'packages/certification/src',
  'packages/persistence/src',
  'packages/orchestration/src',
  'packages/pack-contract/src',
] as const;

export function getSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory() && entry !== 'dist' && entry !== 'node_modules') {
      results.push(...getSourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

export function scanPackageForForbiddenTerms(
  packageRelativePath: string,
  allowedPaths: readonly string[] = [],
): Array<{ file: string; term: string }> {
  const dir = join(REPO_ROOT, packageRelativePath);
  const violations: Array<{ file: string; term: string }> = [];
  for (const file of getSourceFiles(dir)) {
    const relative = file.replace(REPO_ROOT + '\\', '').replace(REPO_ROOT + '/', '');
    if (allowedPaths.some((allowed) => relative.includes(allowed))) {
      continue;
    }
    const content = readFileSync(file, 'utf8');
    for (const term of FORBIDDEN_DOMAIN_TERMS) {
      if (content.includes(term)) {
        violations.push({ file: relative, term });
      }
    }
  }
  return violations;
}

export function expectCompositionError(
  fn: () => unknown,
  code: string,
): void {
  try {
    fn();
    throw new Error(`Expected PackCompositionError with code ${code}`);
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}
