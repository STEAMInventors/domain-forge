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
      'PROVISIONAL',
    );
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFIED');

    evaluator.markCorpusStale(pack.corpusHash);
    const evaluation = await evaluator.evaluate(packVersion.packContentHash, pack.corpusHash);
    expect(evaluation.isStale).toBe(true);

    const suspended = await handleStalenessEvent(packVersion, evaluation);
    expect(suspended.state).toBe('SUSPENDED');
  });
});
