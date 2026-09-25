import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PrimitiveRegistry,
  ReviewerRoleRegistry,
  OutputSectionTypeRegistry,
  createPackRegistries,
} from '@domain-forge/core';
import { createMinimalTestPack } from '@domain-forge/testing';

const ROOT = join(import.meta.dirname, '../..');
const CORE_REGISTRIES = join(ROOT, 'packages/core/src/registries');

function getSourceFiles(dir: string): string[] {
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

describe('architecture: registries', () => {
  it('@hive/pack-contract registry section schemas do not import Forge packages', () => {
    const file = join(ROOT, 'packages/pack-contract/src/section-schemas.ts');
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/@domain-forge\//);
  });

  it('core registry modules do not embed domain-specific pack entries', () => {
    const files = getSourceFiles(CORE_REGISTRIES);
    const forbidden = ['IEP', 'BIP', 'Medicaid', 'Chapter 7'];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const term of forbidden) {
        expect(content).not.toContain(term);
      }
    }
  });

  it('system registries reject unknown semantics', () => {
    expect(() => PrimitiveRegistry.resolve('INVENTED_PRIMITIVE')).toThrow();
    expect(ReviewerRoleRegistry.has('MEDICAID_EXPERT')).toBe(false);
  });

  it('pack registries resolve from composed pack without domain knowledge in core constants', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
    registries.validateCrossReferences();
    expect(registries.rules.resolve('rule-001').primitive).toBe('REQUIRE');
  });

  it('output section types are centrally registered', () => {
    expect(OutputSectionTypeRegistry.has('FINDINGS_LIST')).toBe(true);
    expect(OutputSectionTypeRegistry.has('CUSTOM_WIDGET')).toBe(false);
  });
});
