import { z } from 'zod';

/** Supported primitive extraction value types — no generic unknown. */
export const ExtractionValueTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'money',
  'duration',
  'quantity',
  'enum',
  'reference',
  'structured_object',
]);

export type ExtractionValueType = z.infer<typeof ExtractionValueTypeSchema>;

/** Cardinality for extracted values within one contract application. */
export const ExtractionCardinalitySchema = z.enum([
  'exactly_one',
  'zero_or_one',
  'one_or_more',
  'zero_or_more',
]);

export type ExtractionCardinality = z.infer<typeof ExtractionCardinalitySchema>;

/** Explicit missingness states permitted by escape hatches — never guessed. */
export const ExtractionMissingnessStateSchema = z.enum(['NOT_PRESENT', 'UNDETERMINED']);

export type ExtractionMissingnessState = z.infer<typeof ExtractionMissingnessStateSchema>;

/** Declarative evidence requirement for an extraction contract entry. */
export const ExtractionEvidenceRequirementSchema = z
  .object({
    required: z.boolean().default(true),
    minCount: z.number().int().min(0).default(1),
    maxCount: z.number().int().min(1).optional(),
  })
  .strict();

export type ExtractionEvidenceRequirement = z.infer<typeof ExtractionEvidenceRequirementSchema>;

/** Document recognition guidance — model-facing, declarative. */
export const DocumentRecognitionSchema = z
  .object({
    recognitionCues: z.array(z.string().min(1).max(512)).min(1),
    typicalSections: z.array(z.string().min(1).max(512)).default([]),
    issuerCues: z.array(z.string().min(1).max(512)).default([]),
    distinguishingLookalikes: z.array(z.string().min(1).max(512)).default([]),
    relevantDates: z.array(z.string().min(1).max(256)).default([]),
    identifiers: z.array(z.string().min(1).max(256)).default([]),
  })
  .strict();

export type DocumentRecognition = z.infer<typeof DocumentRecognitionSchema>;

/** Per-fact escape hatch guidance from architecture section 18. */
export const ExtractionEscapeHatchesSchema = z
  .object({
    notPresent: z.string().min(1).max(4096).optional(),
    undetermined: z.string().min(1).max(4096).optional(),
    reviewRequired: z.array(z.string().min(1).max(512)).default([]),
  })
  .strict();

export type ExtractionEscapeHatches = z.infer<typeof ExtractionEscapeHatchesSchema>;

/** Model-facing identity hint — code accepts/rejects proposed matches. */
export const ExtractionIdentityHintSchema = z
  .object({
    id: z.string().min(1).max(128),
    hint: z.string().min(1).max(4096),
    entityId: z.string().min(1).max(128).optional(),
  })
  .strict();

export type ExtractionIdentityHint = z.infer<typeof ExtractionIdentityHintSchema>;

/** Domain factual/linguistic boundary for output rewriting — not brand voice. */
export const ExtractionPhrasingConstraintSchema = z
  .object({
    id: z.string().min(1).max(128),
    constraint: z.string().min(1).max(4096),
    factIds: z.array(z.string().min(1).max(128)).default([]),
  })
  .strict();

export type ExtractionPhrasingConstraint = z.infer<typeof ExtractionPhrasingConstraintSchema>;

/** Pack registry target for reference-typed extraction values. */
export const ExtractionReferenceRegistrySchema = z.enum(['vocabulary', 'entities']);

export type ExtractionReferenceRegistry = z.infer<typeof ExtractionReferenceRegistrySchema>;

/**
 * ExtractionContractV0 entry — one fact's extraction guidance.
 *
 * Provider-neutral, declarative pack content. No execution code or model instructions.
 */
export const ExtractionContractEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
    factId: z.string().min(1).max(128),
    definition: z.string().min(1).max(4096),
    normalLocation: z.string().min(1).max(1024).optional(),
    positiveExamples: z.array(z.string().min(1).max(1024)).default([]),
    negativeExamples: z.array(z.string().min(1).max(1024)).default([]),
    excludesDescription: z.string().min(1).max(4096).optional(),
    expectedType: ExtractionValueTypeSchema,
    enumValues: z.array(z.string().min(1).max(256)).optional(),
    referenceRegistry: ExtractionReferenceRegistrySchema.optional(),
    constructId: z.string().min(1).max(128).optional(),
    roleId: z.string().min(1).max(128).optional(),
    subjectId: z.string().min(1).max(128).optional(),
    unitId: z.string().min(1).max(128).optional(),
    unitRequired: z.boolean().default(false),
    cardinality: ExtractionCardinalitySchema,
    evidence: ExtractionEvidenceRequirementSchema.default({ required: true, minCount: 1 }),
    escapeHatches: ExtractionEscapeHatchesSchema.optional(),
    documentTypeIds: z.array(z.string().min(1).max(128)).default([]),
    entityId: z.string().min(1).max(128).optional(),
    vocabularyRefs: z.array(z.string().min(1).max(128)).default([]),
    documentRecognition: DocumentRecognitionSchema.optional(),
    identityHints: z.array(ExtractionIdentityHintSchema).default([]),
    phrasingConstraints: z.array(ExtractionPhrasingConstraintSchema).default([]),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.expectedType === 'enum' && (!entry.enumValues || entry.enumValues.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'enum expectedType requires non-empty enumValues',
        path: ['enumValues'],
      });
    }
    if (entry.expectedType === 'reference' && entry.referenceRegistry === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reference expectedType requires referenceRegistry',
        path: ['referenceRegistry'],
      });
    }
    if (
      (entry.expectedType === 'duration' || entry.expectedType === 'quantity') &&
      entry.unitRequired &&
      entry.unitId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'unitRequired duration/quantity contracts must declare unitId',
        path: ['unitId'],
      });
    }
  });

export type ExtractionContractEntry = z.infer<typeof ExtractionContractEntrySchema>;

export function parseExtractionContractEntry(input: unknown): ExtractionContractEntry {
  return ExtractionContractEntrySchema.parse(input);
}

export function safeParseExtractionContractEntry(input: unknown) {
  return ExtractionContractEntrySchema.safeParse(input);
}
