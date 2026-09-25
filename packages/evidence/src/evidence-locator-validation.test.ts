import { describe, it, expect } from 'vitest';
import { parseEvidenceLocator, validateEvidenceLocator } from './evidence-locator-validation.js';

describe('parseEvidenceLocator', () => {
  it('accepts valid page locator', () => {
    const result = parseEvidenceLocator({ kind: 'page', page: 3 });
    expect(result.errors).toHaveLength(0);
    expect(result.locator).toEqual({ kind: 'page', page: 3 });
  });

  it('rejects page zero', () => {
    const result = parseEvidenceLocator({ kind: 'page', page: 0 });
    expect(result.errors[0]?.code).toBe('EVIDENCE_LOCATOR_INVALID');
  });

  it('rejects inverted line range', () => {
    const result = parseEvidenceLocator({ kind: 'line_range', startLine: 5, endLine: 3 });
    expect(result.errors[0]?.path).toBe('locator.endLine');
  });

  it('accepts boundary-equal line range', () => {
    const result = parseEvidenceLocator({ kind: 'line_range', startLine: 2, endLine: 2 });
    expect(result.errors).toHaveLength(0);
  });

  it('rejects ambiguous locator combinations', () => {
    const result = parseEvidenceLocator({ kind: 'page', page: 1, startLine: 1 });
    expect(result.errors[0]?.message).toContain('Ambiguous');
  });

  it('rejects invalid character span', () => {
    const result = parseEvidenceLocator({ kind: 'character_span', startOffset: 5, endOffset: 5 });
    expect(result.errors[0]?.path).toBe('locator.endOffset');
  });

  it('accepts valid character span at boundary', () => {
    const result = parseEvidenceLocator({ kind: 'character_span', startOffset: 0, endOffset: 1 });
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty section heading', () => {
    const result = parseEvidenceLocator({ kind: 'section', heading: '   ' });
    expect(result.errors[0]?.code).toBe('EVIDENCE_LOCATOR_INVALID');
  });

  it('rejects malformed field path', () => {
    const result = parseEvidenceLocator({ kind: 'field_path', path: 'bad path!' });
    expect(result.errors).toHaveLength(1);
  });
});

describe('validateEvidenceLocator', () => {
  it('validates typed locator objects', () => {
    expect(validateEvidenceLocator({ kind: 'fragment', fragmentId: 'sec-1' }).valid).toBe(true);
  });
});
