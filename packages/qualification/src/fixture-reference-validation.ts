import type { DomainPackV0 } from '@hive/pack-contract';
import type {
  AcceptedFixtureCorpus,
  PackFixtureReferenceValidator,
  QualificationError,
} from '@domain-forge/contracts';
import { qualificationError } from './qualification-errors.js';

function collectCorpusFixtureIds(corpus: AcceptedFixtureCorpus['corpus']): Set<string> {
  const ids = new Set<string>();
  for (const fixture of corpus.standaloneFixtures) {
    ids.add(fixture.id);
  }
  for (const fixtureCase of corpus.cases) {
    for (const fixture of fixtureCase.fixtures) {
      ids.add(fixture.id);
    }
  }
  return ids;
}

export class DefaultPackFixtureReferenceValidator implements PackFixtureReferenceValidator {
  validate(
    pack: DomainPackV0,
    fixtureCorpus: AcceptedFixtureCorpus,
    packContentHash: string,
  ): readonly QualificationError[] {
    const errors: QualificationError[] = [];
    const corpusIds = collectCorpusFixtureIds(fixtureCorpus.corpus);

    for (const ref of pack.fixtureReferences) {
      if (ref.corpusId !== undefined && ref.corpusId !== fixtureCorpus.corpus.corpusId) {
        errors.push(
          qualificationError(
            'FIXTURE_REFERENCE_MISMATCH',
            `Fixture reference corpusId ${ref.corpusId} does not match qualification corpus ${fixtureCorpus.corpus.corpusId}`,
            `fixtureReferences.${ref.id}.corpusId`,
            { expected: fixtureCorpus.corpus.corpusId, actual: ref.corpusId },
          ),
        );
      }

      if (
        ref.fixtureCorpusHash !== undefined &&
        ref.fixtureCorpusHash !== fixtureCorpus.fixtureCorpusHash
      ) {
        errors.push(
          qualificationError(
            'FIXTURE_CORPUS_MISMATCH',
            `Fixture reference fixtureCorpusHash does not match accepted corpus hash`,
            `fixtureReferences.${ref.id}.fixtureCorpusHash`,
            {
              expected: fixtureCorpus.fixtureCorpusHash,
              actual: ref.fixtureCorpusHash,
            },
          ),
        );
      }

      if (ref.packContentHash !== undefined && ref.packContentHash !== packContentHash) {
        errors.push(
          qualificationError(
            'PACK_HASH_MISMATCH',
            `Fixture reference packContentHash pin does not match pack under qualification`,
            `fixtureReferences.${ref.id}.packContentHash`,
            { expected: packContentHash, actual: ref.packContentHash },
          ),
        );
      }

      if (ref.fixtureIds.length > 0) {
        for (const fixtureId of ref.fixtureIds) {
          if (!corpusIds.has(fixtureId)) {
            errors.push(
              qualificationError(
                'FIXTURE_REFERENCE_MISMATCH',
                `Referenced fixture ${fixtureId} is not present in accepted fixture corpus`,
                `fixtureReferences.${ref.id}.fixtureIds`,
                { fixtureId },
              ),
            );
          }
        }
      }
    }

    return errors;
  }
}
