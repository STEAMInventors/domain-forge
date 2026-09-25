import type {
  ExtractionQualificationState,
  QualificationRecord,
  QualificationStalenessEvaluation,
  QualificationStalenessEvaluator,
  QualificationStalenessReason,
} from '@domain-forge/contracts';

export class DefaultQualificationStalenessEvaluator implements QualificationStalenessEvaluator {
  evaluate(
    record: QualificationRecord,
    current: {
      packContentHash: string;
      packCompositionHash?: string;
      fixtureCorpusHash: string;
      authorityCorpusHash?: string;
      qualificationProfileId: string;
      qualificationProfileVersion: string;
      extractionRuntime?: {
        hiveVersion: string;
        extractionModelFamily: string;
        extractionModelVersion: string;
        extractionPolicyVersion: string;
      };
    },
  ): QualificationStalenessEvaluation {
    const reasons: QualificationStalenessReason[] = [];

    if (record.identity.packContentHash !== current.packContentHash) {
      reasons.push('PACK_CONTENT_HASH_CHANGED');
    }

    const recordComposition = record.identity.packCompositionHash;
    if (
      recordComposition !== undefined ||
      current.packCompositionHash !== undefined
    ) {
      if (recordComposition !== current.packCompositionHash) {
        reasons.push('PACK_COMPOSITION_HASH_CHANGED');
      }
    }

    if (record.identity.fixtureCorpusHash !== current.fixtureCorpusHash) {
      reasons.push('FIXTURE_CORPUS_HASH_CHANGED');
    }

    const recordAuthority = record.identity.authorityCorpusHash;
    if (recordAuthority !== undefined || current.authorityCorpusHash !== undefined) {
      if (recordAuthority !== current.authorityCorpusHash) {
        reasons.push('AUTHORITY_CORPUS_HASH_CHANGED');
      }
    }

    if (
      record.identity.qualificationProfileId !== current.qualificationProfileId ||
      record.identity.qualificationProfileVersion !== current.qualificationProfileVersion
    ) {
      reasons.push('QUALIFICATION_PROFILE_VERSION_CHANGED');
    }

    if (record.extractionQualification !== undefined && current.extractionRuntime !== undefined) {
      const ext = record.extractionQualification;
      const runtime = current.extractionRuntime;
      if (
        ext.hiveCoreVersion !== runtime.hiveVersion ||
        ext.extractionModelFamily !== runtime.extractionModelFamily ||
        ext.extractionModelVersion !== runtime.extractionModelVersion ||
        ext.extractionPolicyVersion !== runtime.extractionPolicyVersion
      ) {
        reasons.push('EXTRACTION_RUNTIME_CHANGED');
      }
    }

    return {
      isStale: reasons.length > 0,
      reasons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export function mapExtractionQualificationState(
  status: QualificationRecord['status'],
  isStale: boolean,
): ExtractionQualificationState {
  if (isStale) return 'STALE';
  switch (status) {
    case 'passed':
      return 'QUALIFIED';
    case 'failed':
      return 'FAILED';
    case 'incomplete':
    case 'blocked':
      return 'NOT_TESTED';
    case 'requires_review':
      return 'NOT_TESTED';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
