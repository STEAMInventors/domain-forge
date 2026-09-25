import type { EvidenceLocator, EvidenceValidationError, EvidenceValidationResult } from '@domain-forge/contracts';

function err(
  code: EvidenceValidationError['code'],
  message: string,
  path?: string,
): EvidenceValidationError {
  return path !== undefined ? { code, message, path } : { code, message };
}

function fail(errors: EvidenceValidationError[]): EvidenceValidationResult {
  return { valid: false, errors };
}

function pass(): EvidenceValidationResult {
  return { valid: true, errors: [] };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasMultipleLocatorKinds(locator: Record<string, unknown>): boolean {
  const kinds = ['page', 'startLine', 'heading', 'index', 'startOffset', 'path', 'fragmentId'].filter(
    (key) => locator[key] !== undefined,
  );
  return kinds.length > 1;
}

/** Parse and validate a locator from structured input — rejects ambiguous combinations */
export function parseEvidenceLocator(input: unknown): { locator?: EvidenceLocator; errors: EvidenceValidationError[] } {
  if (!isPlainObject(input)) {
    return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'Evidence locator must be an object', 'locator')] };
  }

  const kind = input['kind'];
  if (typeof kind !== 'string') {
    return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'Evidence locator requires exactly one kind', 'locator.kind')] };
  }

  if (hasMultipleLocatorKinds(input)) {
    return {
      errors: [err('EVIDENCE_LOCATOR_INVALID', 'Ambiguous locator: multiple locator fields present', 'locator')],
    };
  }

  switch (kind) {
    case 'page': {
      const page = input['page'];
      if (typeof page !== 'number' || !Number.isInteger(page) || page < 1) {
        return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'Page must be a positive integer >= 1', 'locator.page')] };
      }
      return { locator: { kind: 'page', page }, errors: [] };
    }
    case 'line_range': {
      const startLine = input['startLine'];
      const endLine = input['endLine'];
      if (typeof startLine !== 'number' || !Number.isInteger(startLine) || startLine < 1) {
        return {
          errors: [err('EVIDENCE_LOCATOR_INVALID', 'startLine must be a positive integer >= 1', 'locator.startLine')],
        };
      }
      if (typeof endLine !== 'number' || !Number.isInteger(endLine) || endLine < startLine) {
        return {
          errors: [err('EVIDENCE_LOCATOR_INVALID', 'endLine must be an integer >= startLine', 'locator.endLine')],
        };
      }
      return { locator: { kind: 'line_range', startLine, endLine }, errors: [] };
    }
    case 'section': {
      const heading = input['heading'];
      if (typeof heading !== 'string' || !heading.trim()) {
        return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'Section heading must be non-empty', 'locator.heading')] };
      }
      const level = input['level'];
      if (level !== undefined && (typeof level !== 'number' || !Number.isInteger(level) || level < 1)) {
        return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'Section level must be a positive integer', 'locator.level')] };
      }
      const locator: EvidenceLocator = { kind: 'section', heading: heading.trim() };
      if (typeof level === 'number') {
        return { locator: { ...locator, level }, errors: [] };
      }
      return { locator, errors: [] };
    }
    case 'paragraph': {
      const index = input['index'];
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
        return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'Paragraph index must be a non-negative integer', 'locator.index')] };
      }
      return { locator: { kind: 'paragraph', index }, errors: [] };
    }
    case 'character_span': {
      const startOffset = input['startOffset'];
      const endOffset = input['endOffset'];
      if (typeof startOffset !== 'number' || !Number.isInteger(startOffset) || startOffset < 0) {
        return {
          errors: [err('EVIDENCE_LOCATOR_INVALID', 'startOffset must be a non-negative integer', 'locator.startOffset')],
        };
      }
      if (typeof endOffset !== 'number' || !Number.isInteger(endOffset) || endOffset <= startOffset) {
        return {
          errors: [err('EVIDENCE_LOCATOR_INVALID', 'endOffset must be an integer > startOffset', 'locator.endOffset')],
        };
      }
      return { locator: { kind: 'character_span', startOffset, endOffset }, errors: [] };
    }
    case 'field_path': {
      const path = input['path'];
      if (typeof path !== 'string' || !path.trim() || !/^[a-zA-Z0-9_.[\]-]+$/.test(path)) {
        return {
          errors: [err('EVIDENCE_LOCATOR_INVALID', 'field_path must be a non-empty machine-readable path', 'locator.path')],
        };
      }
      return { locator: { kind: 'field_path', path: path.trim() }, errors: [] };
    }
    case 'fragment': {
      const fragmentId = input['fragmentId'];
      if (typeof fragmentId !== 'string' || !fragmentId.trim()) {
        return { errors: [err('EVIDENCE_LOCATOR_INVALID', 'fragmentId must be non-empty', 'locator.fragmentId')] };
      }
      return { locator: { kind: 'fragment', fragmentId: fragmentId.trim() }, errors: [] };
    }
    default:
      return { errors: [err('EVIDENCE_LOCATOR_INVALID', `Unknown locator kind: ${kind}`, 'locator.kind')] };
  }
}

export function validateEvidenceLocator(locator: EvidenceLocator): EvidenceValidationResult {
  const parsed = parseEvidenceLocator(locator);
  return parsed.errors.length ? fail(parsed.errors) : pass();
}
