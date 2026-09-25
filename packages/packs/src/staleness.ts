import { applyPackVersionTransition } from './pack-version-service.js';
import type { StalenessEvaluation } from '@domain-forge/contracts';
import type { PackVersion } from '@domain-forge/contracts';

export class DefaultStalenessEvaluator {
  private staleAuthorityCorpusHashes = new Set<string>();

  markAuthorityCorpusStale(authorityCorpusHash: string): void {
    this.staleAuthorityCorpusHashes.add(authorityCorpusHash);
  }

  async evaluate(
    packContentHash: string,
    authorityCorpusHash?: string,
  ): Promise<StalenessEvaluation> {
    const reasons: StalenessEvaluation['reasons'][number][] = [];
    if (
      authorityCorpusHash !== undefined &&
      this.staleAuthorityCorpusHashes.has(authorityCorpusHash)
    ) {
      reasons.push('CORPUS_REQUALIFICATION_REQUIRED');
    }
    return {
      isStale: reasons.length > 0,
      reasons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export async function handleStalenessEvent(
  packVersion: PackVersion,
  evaluation: StalenessEvaluation,
): Promise<PackVersion> {
  if (!evaluation.isStale || packVersion.state !== 'CERTIFIED') {
    return packVersion;
  }

  const { packVersion: suspended } = applyPackVersionTransition(packVersion, 'SUSPEND', {
    reasonRef: evaluation.reasons.join(','),
  });
  return suspended;
}
