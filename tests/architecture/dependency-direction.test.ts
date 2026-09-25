import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');
const PACK_CONTRACT = join(ROOT, 'packages/pack-contract');

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

describe('architecture: dependency direction', () => {
  it('@hive/pack-contract must not import any Forge package', () => {
    const files = getSourceFiles(join(PACK_CONTRACT, 'src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@domain-forge\//);
    }
  });

  it('@hive/pack-contract must not reference Forge orchestration concepts', () => {
    const files = getSourceFiles(join(PACK_CONTRACT, 'src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/ForgeRun|ForgeStage|StageAttempt/);
    }
  });
});
