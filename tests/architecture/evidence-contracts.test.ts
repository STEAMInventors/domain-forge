import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildSourceSnapshot } from '@domain-forge/sources';
import { buildSourceRecordFromSnapshot, getSnapshotNormalizedText } from '@domain-forge/sources';
import { acceptProposedEvidenceReference } from '@domain-forge/evidence';
import { EvidenceReferenceValidator } from '@domain-forge/validation';
import { normalizeQuoteV0 } from '@domain-forge/evidence';

const ROOT = join(import.meta.dirname, '../..');
const PACK_CONTRACT = join(ROOT, 'packages/pack-contract');
const CONTRACTS = join(ROOT, 'packages/contracts/src');

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

describe('architecture: evidence/source contracts', () => {
  it('@hive/pack-contract must not import evidence/source Forge packages', () => {
    const files = getSourceFiles(join(PACK_CONTRACT, 'src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@domain-forge\/(evidence|sources)/);
    }
  });

  it('contracts package defines source/evidence types without operational retrieval imports', () => {
    const files = getSourceFiles(CONTRACTS);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/@domain-forge\/(sources|orchestration|validation|persistence)/);
    }
  });

  it('rejects model-proposed invalid evidence at validation boundary', () => {
    const snapshot = buildSourceSnapshot({
      url: 'https://example.org/reg',
      rawContent: '<p>Eligible members receive coverage.</p>',
      metadata: { title: 'Regulation' },
    });
    const source = buildSourceRecordFromSnapshot(snapshot);
    const { normalized } = normalizeQuoteV0(getSnapshotNormalizedText(snapshot));

    const validator = new EvidenceReferenceValidator();
    const invalid = validator.validate({
      proposals: [
        {
          source: 'MODEL',
          sourceId: source.identity.sourceId,
          locator: { kind: 'page', page: 1 },
          content: { kind: 'quoted_excerpt', text: 'nonexistent coverage language' },
          rawCitation: 'page 1 says coverage applies',
        },
      ],
      sources: [source],
      getSourceNormalizedText: () => normalized,
    });

    expect(invalid.passed).toBe(false);
    expect(invalid.errors.some((e) => e.code === 'EVIDENCE_VERIFICATION_FAILED')).toBe(true);
  });

  it('accepts traceable evidence through snapshot → source → acceptance chain', () => {
    const snapshot = buildSourceSnapshot({
      url: 'https://example.org/reg',
      rawContent: '<p>Eligible members receive coverage.</p>',
      metadata: {},
    });
    const source = buildSourceRecordFromSnapshot(snapshot);
    const { normalized } = normalizeQuoteV0(getSnapshotNormalizedText(snapshot));

    const outcome = acceptProposedEvidenceReference(
      {
        source: 'MODEL',
        sourceId: source.identity.sourceId,
        locator: { kind: 'character_span', startOffset: 0, endOffset: 10 },
        content: { kind: 'quoted_excerpt', text: 'Eligible members' },
      },
      {
        resolveSource: () => source,
        getSourceNormalizedText: () => normalized,
      },
    );

    expect(outcome.result.valid).toBe(true);
    expect(outcome.accepted?.sourceId).toBe(snapshot.sourceId);
    expect(outcome.accepted?.sourceContentFingerprint).toBe(snapshot.contentHash);
  });
});
