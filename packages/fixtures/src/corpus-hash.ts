import { hashObject } from '@domain-forge/core';
import type { FixtureCorpus, FixtureDefinition } from '@domain-forge/contracts';

/** Deterministic fixture identity fingerprint — distinct from packContentHash. */
export function computeFixtureFingerprint(fixture: FixtureDefinition): string {
  const identityPayload = {
    id: fixture.id,
    domainId: fixture.domainId,
    category: fixture.category,
    tags: [...fixture.tags].sort(),
    sourceBindings: fixture.sourceBindings.map((b) => ({
      sourceId: b.sourceId,
      sourceContentFingerprint: b.sourceContentFingerprint,
      sourceSnapshotId: b.sourceSnapshotId,
      documentTypeId: b.documentTypeId,
      documentLabel: b.documentLabel,
      temporalRole: b.temporalRole,
      effectiveDate: b.effectiveDate,
    })),
    applicableDocumentTypeIds: [...fixture.applicableDocumentTypeIds].sort(),
    packCompatibility: fixture.packCompatibility,
    provenance: fixture.provenance,
    goldFacts: fixture.goldFacts,
    expectedRuleOutcomes: fixture.expectedRuleOutcomes,
    expectedOutput: fixture.expectedOutput,
    forbiddenExpectations: fixture.forbiddenExpectations,
  };
  return hashObject(identityPayload);
}

/** Deterministic hash of an entire fixture corpus set used for qualification binding. */
export function computeFixtureCorpusHash(corpus: FixtureCorpus): string {
  const fixtureFingerprints = [
    ...corpus.standaloneFixtures.map((f) => computeFixtureFingerprint(f)),
    ...corpus.cases.flatMap((c) => c.fixtures.map((f) => computeFixtureFingerprint(f))),
  ].sort();

  const casePayload = corpus.cases.map((c) => ({
    id: c.id,
    domainId: c.domainId,
    tags: [...c.tags].sort(),
    crossDocumentGoldFacts: c.crossDocumentGoldFacts,
    temporalRelationships: c.temporalRelationships,
    forbiddenExpectations: c.forbiddenExpectations,
    fixtureIds: c.fixtures.map((f) => f.id).sort(),
  }));

  return hashObject({
    corpusId: corpus.corpusId,
    domainId: corpus.domainId,
    label: corpus.label,
    fixtureFingerprints,
    cases: casePayload,
    standaloneFixtureIds: corpus.standaloneFixtures.map((f) => f.id).sort(),
  });
}

export function buildAcceptedFixtureCorpus(corpus: FixtureCorpus) {
  const fixtureCorpusHash = computeFixtureCorpusHash(corpus);
  return {
    source: 'APPROVED' as const,
    corpus,
    fixtureCorpusHash,
  };
}
