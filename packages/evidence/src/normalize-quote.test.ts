import { describe, it, expect } from 'vitest';
import { normalizeQuoteV0 } from './normalize-quote.js';

describe('quote normalization v0', () => {
  it('applies NFC normalization', () => {
    const { normalized } = normalizeQuoteV0('café');
    expect(normalized).toBe('café');
  });

  it('collapses whitespace', () => {
    const { normalized, operationsApplied } = normalizeQuoteV0('hello   world\n\ntest');
    expect(normalized).toBe('hello world test');
    expect(operationsApplied).toContain('whitespace_collapse');
  });

  it('folds quote marks', () => {
    const { normalized } = normalizeQuoteV0('\u201Cquoted\u201D');
    expect(normalized).toBe('"quoted"');
  });
});
