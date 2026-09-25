import { describe, it, expect } from 'vitest';
import { FixtureReferenceSchema } from './fixture-reference-v0.js';

describe('FixtureReferenceSchema', () => {
  it('accepts minimal declarative reference', () => {
    const result = FixtureReferenceSchema.safeParse({ id: 'fix-ref-001' });
    expect(result.success).toBe(true);
  });

  it('accepts corpus binding with fixtureCorpusHash', () => {
    const result = FixtureReferenceSchema.safeParse({
      id: 'fix-ref-001',
      corpusId: 'corpus-001',
      fixtureCorpusHash: 'a'.repeat(64),
      fixtureIds: ['fixture-001'],
      packContentHash: 'b'.repeat(64),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid fixtureCorpusHash', () => {
    const result = FixtureReferenceSchema.safeParse({
      id: 'fix-ref-001',
      fixtureCorpusHash: 'not-a-hash',
    });
    expect(result.success).toBe(false);
  });
});
