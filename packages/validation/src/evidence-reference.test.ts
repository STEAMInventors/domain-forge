import { describe, it, expect } from 'vitest';
import { buildSourceSnapshot, buildSourceRecordFromSnapshot, getSnapshotNormalizedText } from '@domain-forge/sources';
import { normalizeQuoteV0 } from '@domain-forge/evidence';
import { EvidenceReferenceValidator } from './validators.js';

describe('EvidenceReferenceValidator', () => {
  it('passes valid proposed evidence references', () => {
    const snapshot = buildSourceSnapshot({
      url: 'https://example.org/a',
      rawContent: '<p>Alpha beta gamma.</p>',
      metadata: {},
    });
    const source = buildSourceRecordFromSnapshot(snapshot);
    const normalized = normalizeQuoteV0(getSnapshotNormalizedText(snapshot)).normalized;

    const validator = new EvidenceReferenceValidator();
    const result = validator.validate({
      proposals: [
        {
          source: 'MODEL',
          sourceId: source.identity.sourceId,
          locator: { kind: 'paragraph', index: 0 },
          content: { kind: 'quoted_excerpt', text: 'Alpha beta' },
        },
      ],
      sources: [source],
      getSourceNormalizedText: () => normalized,
    });

    expect(result.passed).toBe(true);
  });
});
