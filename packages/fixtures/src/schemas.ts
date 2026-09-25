import { z } from 'zod';
import {
  DOMAIN_PACK_SCHEMA_VERSION,
  ExtractionMissingnessStateSchema,
  OutputRuleOutcomeIdSchema,
} from '@hive/pack-contract';
import { FIXTURE_CATEGORIES } from '@domain-forge/contracts';

const EvidenceLocatorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('page'), page: z.number().int().min(1) }).strict(),
  z
    .object({
      kind: z.literal('line_range'),
      startLine: z.number().int().min(1),
      endLine: z.number().int().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('section'),
      heading: z.string().min(1).max(512),
      level: z.number().int().min(1).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('paragraph'), index: z.number().int().min(0) }).strict(),
  z
    .object({
      kind: z.literal('character_span'),
      startOffset: z.number().int().min(0),
      endOffset: z.number().int().min(0),
    })
    .strict(),
  z.object({ kind: z.literal('field_path'), path: z.string().min(1).max(512) }).strict(),
  z.object({ kind: z.literal('fragment'), fragmentId: z.string().min(1).max(128) }).strict(),
]);

const ExtractionValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('string'), value: z.string().min(1) }).strict(),
    z.object({ kind: z.literal('number'), value: z.number().finite() }).strict(),
    z.object({ kind: z.literal('boolean'), value: z.boolean() }).strict(),
    z
      .object({ kind: z.literal('date'), value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .strict(),
    z
      .object({
        kind: z.literal('money'),
        amount: z.number().finite(),
        currency: z.string().min(1).max(16),
      })
      .strict(),
    z
      .object({
        kind: z.literal('duration'),
        value: z.number().finite(),
        unitId: z.string().min(1).max(128),
      })
      .strict(),
    z
      .object({
        kind: z.literal('quantity'),
        value: z.number().finite(),
        unitId: z.string().min(1).max(128),
      })
      .strict(),
    z.object({ kind: z.literal('enum'), value: z.string().min(1).max(256) }).strict(),
    z.object({ kind: z.literal('reference'), refId: z.string().min(1).max(128) }).strict(),
    z
      .object({
        kind: z.literal('structured_object'),
        fields: z.record(ExtractionValueSchema),
      })
      .strict(),
  ]),
);

const ExtractionOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('value'), value: ExtractionValueSchema }).strict(),
  z
    .object({ kind: z.literal('missingness'), state: ExtractionMissingnessStateSchema })
    .strict(),
]);

export const GoldApprovalRecordSchema = z
  .object({
    status: z.enum(['approved', 'pending', 'rejected']),
    reviewerRole: z.string().min(1).max(128),
    reviewerRef: z.string().min(1).max(128).optional(),
    approvalVersion: z.string().min(1).max(64).optional(),
    reasonNoteRef: z.string().min(1).max(256).optional(),
  })
  .strict();

export const GoldEvidenceExpectationSchema = z
  .object({
    sourceId: z.string().min(1).max(128),
    sourceContentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    locator: EvidenceLocatorSchema,
    quoteVerified: z.boolean().optional(),
    normalizedQuote: z.string().min(1).max(4096).optional(),
  })
  .strict();

export const GoldFactExpectationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('present'),
      outcomes: z.array(ExtractionOutcomeSchema).min(1),
    })
    .strict(),
  z.object({ kind: z.literal('forbidden') }).strict(),
  z
    .object({
      kind: z.literal('missingness'),
      state: ExtractionMissingnessStateSchema,
    })
    .strict(),
]);

export const GoldFactSchema = z
  .object({
    id: z.string().min(1).max(128),
    extractionContractId: z.string().min(1).max(128),
    factId: z.string().min(1).max(128),
    entityId: z.string().min(1).max(128).optional(),
    entityInstanceId: z.string().min(1).max(128).optional(),
    constructId: z.string().min(1).max(128).optional(),
    roleId: z.string().min(1).max(128).optional(),
    subjectId: z.string().min(1).max(128).optional(),
    documentTypeId: z.string().min(1).max(128).optional(),
    sourceBindingRef: z.string().min(1).max(128).optional(),
    expectation: GoldFactExpectationSchema,
    expectedEvidence: z.array(GoldEvidenceExpectationSchema).default([]),
    approval: GoldApprovalRecordSchema.optional(),
  })
  .strict();

export const ExpectedRuleOutcomeSchema = z
  .object({
    ruleId: z.string().min(1).max(128),
    outcome: OutputRuleOutcomeIdSchema,
    supportingFactIds: z.array(z.string().min(1).max(128)).default([]),
    supportingChipRefs: z.array(z.string().min(1).max(128)).default([]),
    expectedEvidence: z.array(GoldEvidenceExpectationSchema).default([]),
  })
  .strict();

export const ForbiddenExpectationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('fact'),
      factId: z.string().min(1).max(128),
      contractId: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('claim'),
      claimTypeId: z.string().min(1).max(128),
      specificationId: z.string().min(1).max(128).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('rule_fired'), ruleId: z.string().min(1).max(128) }).strict(),
  z
    .object({
      kind: z.literal('output_section'),
      specificationId: z.string().min(1).max(128),
      sectionId: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({
      kind: z.literal('narrative'),
      specificationId: z.string().min(1).max(128).optional(),
      claimTypeId: z.string().min(1).max(128).optional(),
      sectionId: z.string().min(1).max(128).optional(),
    })
    .strict(),
]);

export const FixtureSourceBindingSchema = z
  .object({
    sourceId: z.string().min(1).max(128),
    sourceContentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    sourceSnapshotId: z.string().min(1).max(128).optional(),
    documentTypeId: z.string().min(1).max(128),
    documentLabel: z.string().min(1).max(256).optional(),
    temporalRole: z.enum(['current', 'historical', 'unknown']).optional(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

export const FixtureProvenanceSchema = z
  .object({
    materialClass: z.enum(['synthetic', 'real_corpus']),
    description: z.string().min(1).max(4096).optional(),
    generationModelProvider: z.string().min(1).max(128).optional(),
    generationModelFamily: z.string().min(1).max(128).optional(),
    generationPolicyVersion: z.string().min(1).max(64).optional(),
    authoredByRole: z.string().min(1).max(128).optional(),
    noteRef: z.string().min(1).max(256).optional(),
  })
  .strict();

export const FixturePackCompatibilitySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('domain_independent'), domainId: z.string().min(1).max(128) }).strict(),
  z
    .object({ mode: z.literal('schema_version'), schemaVersion: z.literal(DOMAIN_PACK_SCHEMA_VERSION) })
    .strict(),
  z
    .object({
      mode: z.literal('pinned_pack'),
      packId: z.string().min(1).max(128),
      packVersion: z.string().min(1).max(64),
      packContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
]);

export const ExpectedOutputSectionPresenceSchema = z
  .object({
    specificationId: z.string().min(1).max(128),
    sectionId: z.string().min(1).max(128),
    expectation: z.enum(['present', 'absent']),
  })
  .strict();

export const ExpectedClaimPresenceSchema = z
  .object({
    specificationId: z.string().min(1).max(128),
    claimTypeId: z.string().min(1).max(128),
    expectation: z.enum(['present', 'forbidden']),
  })
  .strict();

export const ExpectedOutputBehaviorSchema = z
  .object({
    specificationId: z.string().min(1).max(128),
    sectionPresence: z.array(ExpectedOutputSectionPresenceSchema).default([]),
    claimPresence: z.array(ExpectedClaimPresenceSchema).default([]),
    questionIds: z.array(z.string().min(1).max(128)).default([]),
    documentTypeIds: z.array(z.string().min(1).max(128)).default([]),
    professionalOnlySectionIds: z.array(z.string().min(1).max(128)).default([]),
    customerTopNClaimTypeIds: z.array(z.string().min(1).max(128)).default([]),
    urgencyClaimTypeIds: z.array(z.string().min(1).max(128)).default([]),
  })
  .strict();

export const FixtureDefinitionSchema = z
  .object({
    id: z.string().min(1).max(128),
    domainId: z.string().min(1).max(128),
    category: z.enum(FIXTURE_CATEGORIES),
    tags: z.array(z.string().min(1).max(128)).default([]),
    sourceBindings: z.array(FixtureSourceBindingSchema).min(1),
    applicableDocumentTypeIds: z.array(z.string().min(1).max(128)).min(1),
    packCompatibility: FixturePackCompatibilitySchema,
    provenance: FixtureProvenanceSchema,
    goldFacts: z.array(GoldFactSchema).default([]),
    expectedRuleOutcomes: z.array(ExpectedRuleOutcomeSchema).default([]),
    expectedOutput: ExpectedOutputBehaviorSchema.optional(),
    forbiddenExpectations: z.array(ForbiddenExpectationSchema).default([]),
  })
  .strict();

export const FixtureCaseSchema = z
  .object({
    id: z.string().min(1).max(128),
    domainId: z.string().min(1).max(128),
    tags: z.array(z.string().min(1).max(128)).default([]),
    fixtures: z.array(FixtureDefinitionSchema).min(1),
    crossDocumentGoldFacts: z.array(GoldFactSchema).default([]),
    temporalRelationships: z
      .array(
        z
          .object({
            fromSourceId: z.string().min(1).max(128),
            toSourceId: z.string().min(1).max(128),
            relationship: z.enum(['supersedes', 'conflicts_with', 'continues', 'unknown']),
          })
          .strict(),
      )
      .default([]),
    forbiddenExpectations: z.array(ForbiddenExpectationSchema).default([]),
  })
  .strict();

export const FixtureCorpusSchema = z
  .object({
    corpusId: z.string().min(1).max(128),
    domainId: z.string().min(1).max(128),
    label: z.string().min(1).max(256).optional(),
    cases: z.array(FixtureCaseSchema).default([]),
    standaloneFixtures: z.array(FixtureDefinitionSchema).default([]),
  })
  .strict()
  .refine((c) => c.cases.length > 0 || c.standaloneFixtures.length > 0, {
    message: 'Fixture corpus must contain at least one case or standalone fixture',
  });

export const ProposedFixtureBundleSchema = z
  .object({
    source: z.literal('MODEL'),
    proposalId: z.string().min(1).max(128),
    domainId: z.string().min(1).max(128),
    fixtures: z.array(FixtureDefinitionSchema).default([]),
    cases: z.array(FixtureCaseSchema).default([]),
  })
  .strict()
  .refine((p) => p.fixtures.length > 0 || (p.cases?.length ?? 0) > 0, {
    message: 'Proposed fixture bundle must contain fixtures or cases',
  });

export const AcceptedFixtureCorpusSchema = z
  .object({
    source: z.literal('APPROVED'),
    corpus: FixtureCorpusSchema,
    fixtureCorpusHash: z.string().regex(/^[a-f0-9]{64}$/),
    approval: GoldApprovalRecordSchema.optional(),
  })
  .strict();
