/** Quote normalization v0 — approved operations only */
export const QUOTE_NORMALIZATION_VERSION = '0.1.0';

export const NORMALIZATION_OPERATIONS = [
  'unicode_nfc',
  'whitespace_collapse',
  'quote_mark_fold',
] as const;

export type NormalizationOperation = (typeof NORMALIZATION_OPERATIONS)[number];

export interface NormalizationResult {
  normalized: string;
  operationsApplied: readonly NormalizationOperation[];
  version: string;
}

/** v0: NFC, whitespace collapse, quote-mark folding only */
export function normalizeQuoteV0(text: string): NormalizationResult {
  const operationsApplied: NormalizationOperation[] = [];
  let result = text;

  const nfc = result.normalize('NFC');
  if (nfc !== result) {
    operationsApplied.push('unicode_nfc');
    result = nfc;
  } else {
    operationsApplied.push('unicode_nfc');
  }

  const collapsed = result.replace(/\s+/g, ' ').trim();
  if (collapsed !== result) {
    operationsApplied.push('whitespace_collapse');
    result = collapsed;
  } else {
    operationsApplied.push('whitespace_collapse');
  }

  const folded = result
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'");
  if (folded !== result) {
    operationsApplied.push('quote_mark_fold');
    result = folded;
  } else {
    operationsApplied.push('quote_mark_fold');
  }

  return {
    normalized: result,
    operationsApplied,
    version: QUOTE_NORMALIZATION_VERSION,
  };
}
