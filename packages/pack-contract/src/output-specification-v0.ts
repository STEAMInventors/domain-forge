import { z } from 'zod';

/** Registered rule outcome ids — validated against RuleOutcomeRegistry at reference-check time. */
export const OutputRuleOutcomeIdSchema = z.enum(['FIRED', 'NOT_FIRED', 'UNDETERMINED']);

export type OutputRuleOutcomeId = z.infer<typeof OutputRuleOutcomeIdSchema>;

/** Explicit missingness states for output fields — never collapsed or guessed. */
export const OutputMissingnessStateSchema = z.enum(['NOT_PRESENT', 'UNDETERMINED']);

export type OutputMissingnessState = z.infer<typeof OutputMissingnessStateSchema>;

/** Output audience — professional vs customer projection (architecture section 35). */
export const OutputAudienceSchema = z.enum(['professional', 'customer']);

export type OutputAudience = z.infer<typeof OutputAudienceSchema>;

/** Section empty-state behavior when no validated items exist. */
export const OutputEmptyStateBehaviorSchema = z.enum(['omit', 'show_empty', 'show_message']);

export type OutputEmptyStateBehavior = z.infer<typeof OutputEmptyStateBehaviorSchema>;

/** Declarative support requirement for a claim type — encodes chip boundary (no chip, no claim). */
export const OutputSupportRequirementSchema = z
  .object({
    kind: z.enum(['extraction', 'rule_outcome', 'entity_instance', 'evidence']),
    factId: z.string().min(1).max(128).optional(),
    ruleId: z.string().min(1).max(128).optional(),
    entityId: z.string().min(1).max(128).optional(),
    allowedRuleOutcomes: z.array(OutputRuleOutcomeIdSchema).min(1).optional(),
    minCount: z.number().int().min(1).default(1),
  })
  .strict()
  .superRefine((req, ctx) => {
    if (req.kind === 'extraction' && req.factId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'extraction support requires factId',
        path: ['factId'],
      });
    }
    if (req.kind === 'rule_outcome' && req.ruleId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rule_outcome support requires ruleId',
        path: ['ruleId'],
      });
    }
    if (req.kind === 'entity_instance' && req.entityId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'entity_instance support requires entityId',
        path: ['entityId'],
      });
    }
  });

export type OutputSupportRequirement = z.infer<typeof OutputSupportRequirementSchema>;

/** Pack-defined claim type — claims must satisfy support requirements before acceptance. */
export const OutputClaimTypeDefinitionSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(256).optional(),
    supportRequirements: z.array(OutputSupportRequirementSchema).min(1),
    permitsUndetermined: z.boolean().default(false),
    sectionIds: z.array(z.string().min(1).max(128)).default([]),
  })
  .strict();

export type OutputClaimTypeDefinition = z.infer<typeof OutputClaimTypeDefinitionSchema>;

/** Visibility condition — section appears only when condition holds. */
export const OutputVisibilityConditionSchema = z
  .object({
    ruleId: z.string().min(1).max(128).optional(),
    requiredOutcome: OutputRuleOutcomeIdSchema.optional(),
    factId: z.string().min(1).max(128).optional(),
    missingnessState: OutputMissingnessStateSchema.optional(),
  })
  .strict()
  .superRefine((cond, ctx) => {
    const hasRule = cond.ruleId !== undefined;
    const hasFact = cond.factId !== undefined;
    if (!hasRule && !hasFact) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'visibility requires ruleId or factId',
      });
    }
    if (hasRule && cond.requiredOutcome === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'rule visibility requires requiredOutcome',
        path: ['requiredOutcome'],
      });
    }
    if (hasFact && cond.missingnessState === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fact visibility requires missingnessState',
        path: ['missingnessState'],
      });
    }
  });

export type OutputVisibilityCondition = z.infer<typeof OutputVisibilityConditionSchema>;

/** Section item cardinality bounds. */
export const OutputSectionCardinalitySchema = z
  .object({
    minItems: z.number().int().min(0).default(0),
    maxItems: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
    if (card.maxItems !== undefined && card.maxItems < card.minItems) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxItems must be >= minItems',
        path: ['maxItems'],
      });
    }
  });

export type OutputSectionCardinality = z.infer<typeof OutputSectionCardinalitySchema>;

/** Declarative source for a structured output field. */
export const OutputFieldSourceSchema = z.enum([
  'claim',
  'fact_extraction',
  'rule_outcome',
  'entity',
  'question',
  'document_type',
  'missingness',
]);

export type OutputFieldSource = z.infer<typeof OutputFieldSourceSchema>;

/** Field definition for structured section types. */
export const OutputSectionFieldSchema = z
  .object({
    id: z.string().min(1).max(128),
    source: OutputFieldSourceSchema,
    factId: z.string().min(1).max(128).optional(),
    entityId: z.string().min(1).max(128).optional(),
    claimTypeId: z.string().min(1).max(128).optional(),
    ruleId: z.string().min(1).max(128).optional(),
    questionId: z.string().min(1).max(128).optional(),
    documentTypeId: z.string().min(1).max(128).optional(),
    labelKey: z.string().min(1).max(256).optional(),
    required: z.boolean().default(true),
  })
  .strict()
  .superRefine((field, ctx) => {
    const sourceFieldMap: Partial<Record<OutputFieldSource, keyof typeof field>> = {
      claim: 'claimTypeId',
      fact_extraction: 'factId',
      rule_outcome: 'ruleId',
      entity: 'entityId',
      question: 'questionId',
      document_type: 'documentTypeId',
    };
    const requiredKey = sourceFieldMap[field.source];
    if (requiredKey !== undefined && field[requiredKey] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `source ${field.source} requires ${requiredKey}`,
        path: [requiredKey],
      });
    }
  });

export type OutputSectionField = z.infer<typeof OutputSectionFieldSchema>;

/** Narrative permission constraints — no validated claim, no narrative statement. */
export const OutputNarrativePermissionsSchema = z
  .object({
    allowed: z.boolean().default(false),
    requiresClaimRefs: z.boolean().default(true),
    permitsUncertaintyStatements: z.boolean().default(false),
  })
  .strict();

export type OutputNarrativePermissions = z.infer<typeof OutputNarrativePermissionsSchema>;

/**
 * Output section definition — sectionType validated against OutputSectionTypeRegistry
 * during reference validation, not at parse time.
 */
export const OutputSectionDefinitionSchema = z
  .object({
    id: z.string().min(1).max(128),
    sectionType: z.string().min(1).max(64),
    titleKey: z.string().min(1).max(256).optional(),
    order: z.number().int().min(0),
    group: z.string().min(1).max(128).optional(),
    visibility: OutputVisibilityConditionSchema.optional(),
    cardinality: OutputSectionCardinalitySchema.default({ minItems: 0 }),
    emptyState: OutputEmptyStateBehaviorSchema.default('omit'),
    emptyMessageKey: z.string().min(1).max(256).optional(),
    claimTypeIds: z.array(z.string().min(1).max(128)).default([]),
    sourceFactIds: z.array(z.string().min(1).max(128)).default([]),
    sourceRuleIds: z.array(z.string().min(1).max(128)).default([]),
    sourceEntityIds: z.array(z.string().min(1).max(128)).default([]),
    fields: z.array(OutputSectionFieldSchema).default([]),
    questionIds: z.array(z.string().min(1).max(128)).default([]),
    documentTypeIds: z.array(z.string().min(1).max(128)).default([]),
    missingFactIds: z.array(z.string().min(1).max(128)).default([]),
    timeModelId: z.string().min(1).max(128).optional(),
    evidenceRequired: z.boolean().default(true),
    narrativePermissions: OutputNarrativePermissionsSchema.default({
      allowed: false,
      requiresClaimRefs: true,
      permitsUncertaintyStatements: false,
    }),
    professionalOnly: z.boolean().default(false),
  })
  .strict()
  .superRefine((section, ctx) => {
    if (section.emptyState === 'show_message' && section.emptyMessageKey === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'show_message emptyState requires emptyMessageKey',
        path: ['emptyMessageKey'],
      });
    }
  });

export type OutputSectionDefinition = z.infer<typeof OutputSectionDefinitionSchema>;

/** Customer projection constraints (architecture section 35). */
export const CustomerOutputConstraintsSchema = z
  .object({
    maxFindings: z.number().int().min(0).optional(),
    excludedSectionIds: z.array(z.string().min(1).max(128)).default([]),
    readingLevelLimit: z.string().min(1).max(64).optional(),
  })
  .strict();

export type CustomerOutputConstraints = z.infer<typeof CustomerOutputConstraintsSchema>;

/**
 * OutputSpecificationV0 entry — declarative pack content defining permitted outputs.
 *
 * Provider-neutral. No UI rendering, prose generation, or executable code.
 */
export const OutputSpecificationEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
    audience: OutputAudienceSchema,
    claimTypes: z.array(OutputClaimTypeDefinitionSchema).default([]),
    sections: z.array(OutputSectionDefinitionSchema).min(1),
    customerConstraints: CustomerOutputConstraintsSchema.optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const sectionIds = new Set<string>();
    for (const [index, section] of spec.sections.entries()) {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate section id "${section.id}"`,
          path: ['sections', index, 'id'],
        });
      } else {
        sectionIds.add(section.id);
      }
    }

    const claimTypeIds = new Set(spec.claimTypes.map((c) => c.id));
    if (claimTypeIds.size !== spec.claimTypes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate claim type ids within specification',
        path: ['claimTypes'],
      });
    }

    for (const [index, claimType] of spec.claimTypes.entries()) {
      for (const sectionId of claimType.sectionIds) {
        if (!sectionIds.has(sectionId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `claimType ${claimType.id} references unknown sectionId ${sectionId}`,
            path: ['claimTypes', index, 'sectionIds'],
          });
        }
      }
    }

    if (spec.audience === 'customer' && spec.customerConstraints === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'customer audience specifications require customerConstraints',
        path: ['customerConstraints'],
      });
    }
    if (spec.audience === 'professional' && spec.customerConstraints !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'customerConstraints apply only to customer audience specifications',
        path: ['customerConstraints'],
      });
    }
  });

export type OutputSpecificationEntry = z.infer<typeof OutputSpecificationEntrySchema>;

export function parseOutputSpecificationEntry(input: unknown): OutputSpecificationEntry {
  return OutputSpecificationEntrySchema.parse(input);
}

export function safeParseOutputSpecificationEntry(input: unknown) {
  return OutputSpecificationEntrySchema.safeParse(input);
}
