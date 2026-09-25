import { describe, it, expect } from 'vitest';
import { buildSourceSnapshot } from './snapshot-builder.js';
import { buildSourceRecordFromSnapshot } from './source-record-builder.js';

describe('buildSourceSnapshot', () => {
  it('assigns stable sourceId linked to content hash', () => {
    const snapshot = buildSourceSnapshot({
      url: 'https://example.org/doc',
      rawContent: '<p>Stable content</p>',
      metadata: { title: 'Doc' },
    });

    expect(snapshot.sourceId).toMatch(/^src-/);
    expect(snapshot.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const record = buildSourceRecordFromSnapshot(snapshot);
    expect(record.identity.sourceId).toBe(snapshot.sourceId);
    expect(record.identity.contentFingerprint.hash).toBe(snapshot.contentHash);
  });
});
