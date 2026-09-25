import { EvidenceVerificationError } from '@domain-forge/core';
import { normalizeQuoteV0 } from './normalize-quote.js';

export interface QuoteVerificationInput {
  quote: string;
  sourceNormalizedText: string;
}

export interface QuoteVerificationResult {
  verified: boolean;
  normalizedQuote: string;
  error?: string;
}

export function verifyQuote(input: QuoteVerificationInput): QuoteVerificationResult {
  const { normalized: normalizedQuote } = normalizeQuoteV0(input.quote);

  if (!input.sourceNormalizedText.includes(normalizedQuote)) {
    return {
      verified: false,
      normalizedQuote,
      error: 'EVIDENCE_VERIFICATION_FAILED: quote not found in normalized source text',
    };
  }

  return { verified: true, normalizedQuote };
}

export function assertQuoteVerified(input: QuoteVerificationInput): string {
  const result = verifyQuote(input);
  if (!result.verified) {
    throw new EvidenceVerificationError(result.error ?? 'Quote verification failed', {
      quote: input.quote,
      normalizedQuote: result.normalizedQuote,
    });
  }
  return result.normalizedQuote;
}
