import { describe, it, expect } from 'vitest';
import { DefaultStalenessEvaluator, handleStalenessEvent } from './staleness.js';
import { createPackVersion, applyPackVersionTransition } from './pack-version-service.js';
import { createMinimalTestPack } from '@domain-forge/testing';

describe('staleness', () => {
  it('marks certified pack as suspended when stale', async () => {
    const evaluator = new DefaultStalenessEvaluator();
    const pack = createMinimalTestPack();
    let packVersion = applyPackVersionTransition(
      createPackVersion('pack-001', '0.1.0', pack),
      'PROMOTE_TO_PROVISIONAL',
    ).packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;

    const authorityCorpusHash = pack.corpusHash;
    expect(authorityCorpusHash).toBeDefined();
    evaluator.markAuthorityCorpusStale(authorityCorpusHash!);
    const evaluation = await evaluator.evaluate(
      packVersion.packContentHash,
      authorityCorpusHash,
    );
    expect(evaluation.isStale).toBe(true);

    const suspended = await handleStalenessEvent(packVersion, evaluation);
    expect(suspended.state).toBe('SUSPENDED');
  });
});
