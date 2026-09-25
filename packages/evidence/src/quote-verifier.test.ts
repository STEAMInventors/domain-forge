import { describe, it, expect } from 'vitest';
import { verifyQuote, assertQuoteVerified } from './quote-verifier.js';
import { EvidenceVerificationError } from '@domain-forge/core';
import { normalizeQuoteV0 } from './normalize-quote.js';

describe('quote verifier', () => {
  const sourceText = 'The quick brown fox jumps over the lazy dog.';
  const { normalized: sourceNormalizedText } = normalizeQuoteV0(sourceText);

  it('verifies matching quote', () => {
    const result = verifyQuote({ quote: 'quick brown fox', sourceNormalizedText });
    expect(result.verified).toBe(true);
  });

  it('fails on non-matching quote', () => {
    const result = verifyQuote({ quote: 'nonexistent text', sourceNormalizedText });
    expect(result.verified).toBe(false);
    expect(result.error).toContain('EVIDENCE_VERIFICATION_FAILED');
  });

  it('throws on failed verification', () => {
    expect(() =>
      assertQuoteVerified({ quote: 'fabricated', sourceNormalizedText }),
    ).toThrow(EvidenceVerificationError);
  });
});
