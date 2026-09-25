import { asEvidenceId } from '@domain-forge/core';
import type {
  AcceptedEvidenceReference,
  EvidenceContent,
  EvidenceValidationError,
  EvidenceValidationResult,
  ProposedEvidenceReference,
  SourceRecord,
} from '@domain-forge/contracts';
import { parseEvidenceLocator } from './evidence-locator-validation.js';
import { computeEvidenceReferenceHash } from './evidence-reference-hash.js';
import { computeExcerptHash } from './source-fingerprint.js';
import { verifyQuote } from './quote-verifier.js';

export interface EvidenceAcceptanceContext {
  readonly resolveSource: (sourceId: string) => SourceRecord | undefined;
  readonly getSourceNormalizedText?: (source: SourceRecord) => string | undefined;
}

function fail(errors: EvidenceValidationError[]): EvidenceValidationResult {
  return { valid: false, errors };
}

function pass(): EvidenceValidationResult {
  return { valid: true, errors: [] };
}

function err(
  code: EvidenceValidationError['code'],
  message: string,
  path?: string,
): EvidenceValidationError {
  return path !== undefined ? { code, message, path } : { code, message };
}

function validateEvidenceContent(
  content: EvidenceContent | undefined,
  sourceNormalizedText: string | undefined,
  errors: EvidenceValidationError[],
  pathPrefix: string,
): { normalizedQuote?: string; quoteVerified: boolean } {
  if (!content) {
    return { quoteVerified: false };
  }

  if (!content.text.trim()) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Evidence content text must be non-empty', `${pathPrefix}.text`));
    return { quoteVerified: false };
  }

  if (content.kind === 'interpretation') {
    errors.push(
      err(
        'EVIDENCE_VERIFICATION_FAILED',
        'Generated interpretation cannot be accepted as quoted source evidence',
        `${pathPrefix}.kind`,
      ),
    );
    return { quoteVerified: false };
  }

  if (content.excerptHash !== undefined && content.excerptHash !== computeExcerptHash(content.text)) {
    errors.push(err('EVIDENCE_VERIFICATION_FAILED', 'Quoted excerpt hash mismatch', `${pathPrefix}.excerptHash`));
    return { quoteVerified: false };
  }

  if (!sourceNormalizedText) {
    errors.push(err('SOURCE_NOT_FOUND', 'Cannot verify quoted excerpt without source normalized text', pathPrefix));
    return { quoteVerified: false };
  }

  const verification = verifyQuote({ quote: content.text, sourceNormalizedText });
  if (!verification.verified) {
    errors.push(
      err('EVIDENCE_VERIFICATION_FAILED', verification.error ?? 'Quote verification failed', `${pathPrefix}.text`),
    );
    return { quoteVerified: false, normalizedQuote: verification.normalizedQuote };
  }

  return { quoteVerified: true, normalizedQuote: verification.normalizedQuote };
}

/**
 * Deterministic acceptance boundary for model-proposed evidence references.
 * Raw citation strings never bypass Source/Evidence validation.
 */
export function acceptProposedEvidenceReference(
  proposed: ProposedEvidenceReference,
  context: EvidenceAcceptanceContext,
): { accepted?: AcceptedEvidenceReference; result: EvidenceValidationResult } {
  const errors: EvidenceValidationError[] = [];

  if (proposed.source !== 'MODEL') {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Only MODEL-sourced proposals are accepted at this boundary', 'source'));
  }

  if (!proposed.sourceId.trim()) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Evidence requires a sourceId', 'sourceId'));
  }

  const { locator, errors: locatorErrors } = parseEvidenceLocator(proposed.locator);
  errors.push(...locatorErrors);

  if (errors.length) {
    return { result: fail(errors) };
  }

  const sourceRecord = context.resolveSource(proposed.sourceId);
  if (!sourceRecord) {
    return {
      result: fail([err('SOURCE_NOT_FOUND', `Source not found: ${proposed.sourceId}`, 'sourceId')]),
    };
  }

  const resolvedNormalizedText = context.getSourceNormalizedText?.(sourceRecord);

  const { normalizedQuote, quoteVerified } = validateEvidenceContent(
    proposed.content,
    resolvedNormalizedText,
    errors,
    'content',
  );

  if (errors.length) {
    return { result: fail(errors) };
  }

  if (!locator) {
    return { result: fail([err('EVIDENCE_LOCATOR_INVALID', 'Evidence locator is required', 'locator')]) };
  }

  const sourceContentFingerprint = sourceRecord.identity.contentFingerprint.hash;
  const hashInput = {
    sourceId: proposed.sourceId,
    sourceContentFingerprint,
    locator,
    ...(proposed.content !== undefined ? { content: proposed.content } : {}),
  };
  const evidenceId = asEvidenceId(
    proposed.evidenceId?.trim() || `ev-${computeEvidenceReferenceHash(hashInput).slice(0, 16)}`,
  );

  const content: EvidenceContent | undefined = proposed.content
    ? {
        kind: 'quoted_excerpt',
        text: proposed.content.text,
        excerptHash: computeExcerptHash(proposed.content.text),
        ...(normalizedQuote !== undefined ? { normalizedText: normalizedQuote } : {}),
      }
    : undefined;

  const accepted: AcceptedEvidenceReference = {
    source: 'VALIDATED',
    evidenceId,
    sourceId: sourceRecord.identity.sourceId,
    sourceContentFingerprint,
    locator,
    quoteVerified,
    evidenceReferenceHash: computeEvidenceReferenceHash({
      sourceId: sourceRecord.identity.sourceId,
      sourceContentFingerprint,
      locator,
      ...(content !== undefined ? { content } : {}),
    }),
    ...(content !== undefined ? { content } : {}),
    ...(normalizedQuote !== undefined ? { normalizedQuote } : {}),
  };

  return { accepted, result: pass() };
}

export function acceptProposedEvidenceReferences(
  proposals: readonly ProposedEvidenceReference[],
  context: EvidenceAcceptanceContext,
): { accepted: AcceptedEvidenceReference[]; result: EvidenceValidationResult } {
  const accepted: AcceptedEvidenceReference[] = [];
  const errors: EvidenceValidationError[] = [];

  proposals.forEach((proposal, index) => {
    const outcome = acceptProposedEvidenceReference(proposal, context);
    if (outcome.accepted) {
      accepted.push(outcome.accepted);
    } else {
      for (const error of outcome.result.errors) {
        errors.push({
          ...error,
          path: error.path ? `[${index}].${error.path}` : `[${index}]`,
        });
      }
    }
  });

  return {
    accepted,
    result: errors.length ? fail(errors) : pass(),
  };
}
