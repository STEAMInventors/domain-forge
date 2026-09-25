import type {
  CertificationRecord,
  CertificationStalenessEvaluation,
  CertificationStalenessEvaluator,
  CertificationStalenessReason,
} from '@domain-forge/contracts';

export class DefaultCertificationStalenessEvaluator implements CertificationStalenessEvaluator {
  evaluate(
    record: CertificationRecord,
    current: {
      packContentHash: string;
      packCompositionHash?: string;
      qualificationRecordFingerprint: string;
      fixtureCorpusHash: string;
      authorityCorpusHash?: string;
      certificationProfileId: string;
      certificationProfileVersion: string;
    },
  ): CertificationStalenessEvaluation {
    const reasons: CertificationStalenessReason[] = [];

    if (record.packContentHash !== current.packContentHash) {
      reasons.push('PACK_CONTENT_HASH_CHANGED');
    }

    if (
      record.packCompositionHash !== undefined ||
      current.packCompositionHash !== undefined
    ) {
      if (record.packCompositionHash !== current.packCompositionHash) {
        reasons.push('PACK_COMPOSITION_HASH_CHANGED');
      }
    }

    if (record.qualificationRecordFingerprint !== current.qualificationRecordFingerprint) {
      reasons.push('QUALIFICATION_RECORD_FINGERPRINT_CHANGED');
    }

    if (record.fixtureCorpusHash !== current.fixtureCorpusHash) {
      reasons.push('FIXTURE_CORPUS_HASH_CHANGED');
    }

    if (
      record.authorityCorpusHash !== undefined ||
      current.authorityCorpusHash !== undefined
    ) {
      if (record.authorityCorpusHash !== current.authorityCorpusHash) {
        reasons.push('AUTHORITY_CORPUS_HASH_CHANGED');
      }
    }

    if (
      record.certificationProfileId !== current.certificationProfileId ||
      record.certificationProfileVersion !== current.certificationProfileVersion
    ) {
      reasons.push('CERTIFICATION_PROFILE_VERSION_CHANGED');
    }

    return {
      isStale: reasons.length > 0,
      reasons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

/** Prior certification applicability check — content hash binding only. */
export function certificationApplies(
  certification: CertificationRecord,
  currentPackContentHash: string,
): boolean {
  return (
    certification.packContentHash === currentPackContentHash &&
    certification.decision.kind === 'certified'
  );
}
