import { SOURCE_TYPES, type SourceIdentity, type SourceRecord, type SourceType } from '@domain-forge/contracts';
import type { EvidenceValidationError, EvidenceValidationResult } from '@domain-forge/contracts';

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

function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value);
}

function validateLocator(identity: SourceIdentity, errors: EvidenceValidationError[]): void {
  const locator = identity.locator;
  switch (locator.kind) {
    case 'url':
      if (!locator.url.trim()) {
        errors.push(err('EVIDENCE_REFERENCE_INVALID', 'URL locator requires non-empty url', 'locator.url'));
      }
      break;
    case 'file':
      if (!locator.path.trim()) {
        errors.push(err('EVIDENCE_REFERENCE_INVALID', 'File locator requires non-empty path', 'locator.path'));
      }
      break;
    case 'corpus':
      if (!locator.corpusId.trim() || !locator.entryId.trim()) {
        errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Corpus locator requires corpusId and entryId', 'locator'));
      }
      break;
    case 'artifact':
      if (!locator.artifactId.trim()) {
        errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Artifact locator requires artifactId', 'locator.artifactId'));
      }
      break;
    case 'reference':
      if (!locator.referenceId.trim()) {
        errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Reference locator requires referenceId', 'locator.referenceId'));
      }
      break;
    default: {
      const _exhaustive: never = locator;
      errors.push(err('EVIDENCE_REFERENCE_INVALID', `Unknown locator kind: ${String(_exhaustive)}`, 'locator'));
    }
  }
}

function validateFingerprint(identity: SourceIdentity, errors: EvidenceValidationError[]): void {
  const fp = identity.contentFingerprint;
  if (fp.algorithm !== 'sha256') {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Source fingerprint must use sha256 algorithm', 'contentFingerprint.algorithm'));
  }
  if (!/^[a-f0-9]{64}$/.test(fp.hash)) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Source fingerprint hash must be 64-char hex sha256', 'contentFingerprint.hash'));
  }
  if (fp.representation === 'normalized_text' && !fp.normalizationVersion) {
    errors.push(
      err(
        'EVIDENCE_REFERENCE_INVALID',
        'Normalized text fingerprint requires normalizationVersion',
        'contentFingerprint.normalizationVersion',
      ),
    );
  }
}

export function validateSourceIdentity(identity: SourceIdentity): EvidenceValidationResult {
  const errors: EvidenceValidationError[] = [];

  if (!identity.sourceId.trim()) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Source requires non-empty sourceId', 'sourceId'));
  }
  if (!isSourceType(identity.sourceType)) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', `Unknown source type: ${identity.sourceType}`, 'sourceType'));
  }

  validateLocator(identity, errors);
  validateFingerprint(identity, errors);

  return errors.length ? fail(errors) : pass();
}

export function validateSourceRecord(record: SourceRecord): EvidenceValidationResult {
  const identityResult = validateSourceIdentity(record.identity);
  const errors = [...identityResult.errors];

  if (record.authority?.supersededBySourceId === record.identity.sourceId) {
    errors.push(err('SEMANTIC_VALIDATION_ERROR', 'Source cannot supersede itself', 'authority.supersededBySourceId'));
  }
  if (record.authority?.revokedBySourceId === record.identity.sourceId) {
    errors.push(err('SEMANTIC_VALIDATION_ERROR', 'Source cannot revoke itself', 'authority.revokedBySourceId'));
  }

  return errors.length ? fail(errors) : pass();
}
