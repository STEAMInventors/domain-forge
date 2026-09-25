import type {
  AcceptedEvidenceReference,
  ProvenanceChain,
  SourceRecord,
} from '@domain-forge/contracts';
import type { EvidenceValidationError, EvidenceValidationResult } from '@domain-forge/contracts';

function err(
  code: EvidenceValidationError['code'],
  message: string,
  path?: string,
): EvidenceValidationError {
  return path !== undefined ? { code, message, path } : { code, message };
}

/** Build provenance chain: target → evidence → source → fingerprint/version */
export function buildProvenanceChain(
  targetRef: string,
  evidence: AcceptedEvidenceReference,
  source: SourceRecord,
): ProvenanceChain {
  return {
    targetRef,
    evidenceId: evidence.evidenceId,
    sourceId: evidence.sourceId,
    sourceContentFingerprint: evidence.sourceContentFingerprint,
    ...(source.identity.version !== undefined ? { sourceVersion: source.identity.version } : {}),
    ...(source.identity.effectiveDate !== undefined
      ? { effectiveDate: source.identity.effectiveDate }
      : source.authority?.effectiveDate !== undefined
        ? { effectiveDate: source.authority.effectiveDate }
        : {}),
  };
}

export function validateProvenanceChain(
  chain: ProvenanceChain,
  evidence: AcceptedEvidenceReference,
  source: SourceRecord | undefined,
): EvidenceValidationResult {
  const errors: EvidenceValidationError[] = [];

  if (!chain.targetRef.trim()) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Provenance targetRef is required', 'targetRef'));
  }
  if (chain.evidenceId !== evidence.evidenceId) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Provenance evidenceId mismatch', 'evidenceId'));
  }
  if (chain.sourceId !== evidence.sourceId) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Provenance sourceId mismatch', 'sourceId'));
  }
  if (chain.sourceContentFingerprint !== evidence.sourceContentFingerprint) {
    errors.push(err('EVIDENCE_REFERENCE_INVALID', 'Provenance fingerprint mismatch', 'sourceContentFingerprint'));
  }
  if (!source) {
    errors.push(err('SOURCE_NOT_FOUND', `Provenance source not found: ${chain.sourceId}`, 'sourceId'));
  } else if (source.identity.contentFingerprint.hash !== chain.sourceContentFingerprint) {
    errors.push(
      err('EVIDENCE_REFERENCE_INVALID', 'Provenance fingerprint does not match source record', 'sourceContentFingerprint'),
    );
  }

  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}
