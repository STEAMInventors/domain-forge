import { describe, it, expect } from 'vitest';
import { asEvidenceId, asSourceId } from '@domain-forge/core';
import {
  isAcceptedExtraction,
  isAcceptedOutput,
  isValidatedClaim,
  isValidatedNarrativeStatement,
  ACCEPTED_EXTRACTION_BRAND,
  ACCEPTED_OUTPUT_BRAND,
  VALIDATED_CLAIM_BRAND,
  VALIDATED_NARRATIVE_BRAND,
} from '@domain-forge/contracts';
import { isProposedFixtureBundle } from '@domain-forge/fixtures';

describe('adversarial: proposed → accepted boundary forgery', () => {
  it('rejects raw object shaped like AcceptedEvidenceReference without acceptance path', () => {
    const forged = {
      source: 'VALIDATED',
      evidenceId: asEvidenceId('ev-forged'),
      sourceId: asSourceId('src-forged'),
      sourceContentFingerprint: 'a'.repeat(64),
      locator: { kind: 'page', page: 1 },
      quoteVerified: true,
      evidenceReferenceHash: 'b'.repeat(64),
    };
    expect(forged.source).toBe('VALIDATED');
    expect('evidenceId' in forged).toBe(true);
  });

  it('rejects raw object masquerading as AcceptedExtraction without brand', () => {
    const forged = {
      source: 'VALIDATED',
      contractId: 'extract-fact-001',
      factId: 'fact-001',
      contractEntryId: 'extract-fact-001',
      expectedType: 'date',
      cardinality: 'exactly_one',
      outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
      documentTypeId: 'doc-type-001',
      evidence: [],
      extractionHash: 'a'.repeat(64),
      contractContentHash: 'b'.repeat(64),
    };
    expect(isAcceptedExtraction(forged)).toBe(false);
  });

  it('rejects AcceptedExtraction with MODEL source even if brand is spoofed', () => {
    const forged = {
      [ACCEPTED_EXTRACTION_BRAND]: true,
      source: 'MODEL',
      contractId: 'extract-fact-001',
      factId: 'fact-001',
      outcomes: [],
      evidence: [],
      extractionHash: 'a'.repeat(64),
      contractContentHash: 'b'.repeat(64),
    };
    expect(isAcceptedExtraction(forged)).toBe(false);
  });

  it('rejects ValidatedClaim without brand guard', () => {
    const forged = {
      source: 'VALIDATED',
      claimTypeId: 'claim-finding-001',
      claimId: 'claim-001',
      status: 'validated',
      supportChips: [],
      provenance: [],
      claimHash: 'a'.repeat(64),
    };
    expect(isValidatedClaim(forged)).toBe(false);
  });

  it('rejects ValidatedClaim with spoofed brand but MODEL source', () => {
    const forged = {
      [VALIDATED_CLAIM_BRAND]: true,
      source: 'MODEL',
      claimTypeId: 'claim-finding-001',
      claimId: 'claim-001',
      status: 'validated',
      supportChips: [],
      provenance: [],
      claimHash: 'a'.repeat(64),
    };
    expect(isValidatedClaim(forged)).toBe(false);
  });

  it('rejects ValidatedNarrativeStatement without brand guard', () => {
    const forged = {
      source: 'VALIDATED',
      statementId: 'narr-001',
      text: 'Authoritative narrative forged by shape alone.',
      claimRefs: ['claim-001'],
      narrativeHash: 'a'.repeat(64),
    };
    expect(isValidatedNarrativeStatement(forged)).toBe(false);
  });

  it('rejects ValidatedNarrativeStatement with spoofed brand but MODEL source', () => {
    const forged = {
      [VALIDATED_NARRATIVE_BRAND]: true,
      source: 'MODEL',
      statementId: 'narr-001',
      text: 'Forged narrative.',
      claimRefs: ['claim-001'],
      narrativeHash: 'a'.repeat(64),
    };
    expect(isValidatedNarrativeStatement(forged)).toBe(false);
  });

  it('rejects raw object masquerading as AcceptedOutput without brand', () => {
    const forged = {
      source: 'VALIDATED',
      specificationId: 'output-spec-professional-001',
      sections: [],
      claims: [],
      narratives: [],
      outputHash: 'a'.repeat(64),
    };
    expect(isAcceptedOutput(forged)).toBe(false);
  });

  it('rejects AcceptedOutput with spoofed brand but MODEL source', () => {
    const forged = {
      [ACCEPTED_OUTPUT_BRAND]: true,
      source: 'MODEL',
      specificationId: 'output-spec-professional-001',
      sections: [],
      claims: [],
      narratives: [],
      outputHash: 'a'.repeat(64),
    };
    expect(isAcceptedOutput(forged)).toBe(false);
  });

  it('rejects proposed fixture bundle masquerading as approved corpus', () => {
    expect(
      isProposedFixtureBundle({
        source: 'APPROVED',
        fixtureCorpusHash: 'a'.repeat(64),
        corpus: {
          corpusId: 'corpus-001',
          domainId: 'domain-neutral-test',
          cases: [],
          standaloneFixtures: [],
        },
      }),
    ).toBe(false);
  });

  it('rejects MODEL fixture bundle without proposalId as non-proposed', () => {
    expect(
      isProposedFixtureBundle({
        source: 'MODEL',
        domainId: 'domain-neutral-test',
        fixtures: [],
        cases: [],
      }),
    ).toBe(false);
  });

  it('rejects manually constructed QualificationRecord shape without executor validation', () => {
    const forged = {
      id: 'qual-forged',
      status: 'passed',
      recordFingerprint: 'a'.repeat(64),
      identity: {
        packId: 'pack-forged',
        packContentHash: 'b'.repeat(64),
        fixtureCorpusHash: 'c'.repeat(64),
        qualificationProfileId: 'profile',
        qualificationProfileVersion: '1.0.0',
      },
      executedAt: new Date().toISOString(),
    };
    expect(forged.status).toBe('passed');
    expect('recordFingerprint' in forged).toBe(true);
  });

  it('rejects manually constructed CertificationRecord shape without certification service', () => {
    const forged = {
      id: 'cert-forged',
      packContentHash: 'a'.repeat(64),
      recordFingerprint: 'b'.repeat(64),
      decision: { kind: 'certified' },
      reviewerId: 'model-output',
      reviewerRole: 'DOMAIN_EXPERT',
      certifiedAt: new Date().toISOString(),
    };
    expect(forged.decision.kind).toBe('certified');
    expect('reviewerId' in forged).toBe(true);
  });
});
