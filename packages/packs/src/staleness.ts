import type { StalenessEvaluator, StalenessEvaluation, StalenessEventHandler } from '@domain-forge/contracts';
import { transitionPackVersion } from '@domain-forge/core';
import type { PackVersion } from '@domain-forge/contracts';

export class DefaultStalenessEvaluator implements StalenessEvaluator {
  private readonly staleHashes = new Set<string>();

  markCorpusStale(corpusHash: string): void {
    this.staleHashes.add(corpusHash);
  }

  async evaluate(_packContentHash: string, corpusHash: string): Promise<StalenessEvaluation> {
    const reasons = this.staleHashes.has(corpusHash)
      ? (['SOURCE_CONTENT_CHANGED'] as const)
      : ([] as const);

    return {
      isStale: reasons.length > 0,
      reasons: [...reasons],
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export async function handleStalenessEvent(
  packVersion: PackVersion,
  evaluation: StalenessEvaluation,
  handler?: StalenessEventHandler,
): Promise<PackVersion> {
  if (handler) {
    await handler(packVersion.packId, packVersion.state, evaluation);
  }

  if (evaluation.isStale && packVersion.state === 'CERTIFIED') {
    return {
      ...packVersion,
      state: transitionPackVersion('CERTIFIED', 'SUSPENDED'),
      updatedAt: new Date().toISOString(),
    };
  }

  return packVersion;
}
