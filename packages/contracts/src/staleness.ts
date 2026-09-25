import type { PackVersionState } from '@domain-forge/core';

export type StalenessReason =
  | 'SOURCE_CONTENT_CHANGED'
  | 'EFFECTIVE_DATE_BOUNDARY_REACHED'
  | 'SOURCE_UNAVAILABLE'
  | 'AUTHORITY_SUPERSEDED'
  | 'CORPUS_REQUALIFICATION_REQUIRED';

export interface StalenessEvaluation {
  isStale: boolean;
  reasons: readonly StalenessReason[];
  evaluatedAt: string;
}

export interface StalenessEvaluator {
  evaluate(
    packContentHash: string,
    authorityCorpusHash?: string,
  ): Promise<StalenessEvaluation>;
}

export type StalenessEventHandler = (
  packId: string,
  fromState: PackVersionState,
  evaluation: StalenessEvaluation,
) => void | Promise<void>;
