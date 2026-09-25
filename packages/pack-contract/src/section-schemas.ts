import { z } from 'zod';

/** Minimum authority reference entry for registry resolution. */
export const AuthorityReferenceSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type AuthorityReference = z.infer<typeof AuthorityReferenceSchema>;

/** Minimum document type entry — domain definitions live in packs. */
export const DocumentTypeSchema = z
  .object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

/** Minimum vocabulary term entry — canonical terms are pack-defined. */
export const VocabularyTermSchema = z
  .object({
    id: z.string().min(1).max(128),
    term: z.string().min(1).max(256).optional(),
    canonicalForm: z.string().min(1).max(256).optional(),
  })
  .strict();

export type VocabularyTerm = z.infer<typeof VocabularyTermSchema>;

/** Entity referencing a registered grammar type. */
export const EntitySchema = z
  .object({
    id: z.string().min(1).max(128),
    grammarType: z.string().min(1).max(64),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type Entity = z.infer<typeof EntitySchema>;

/** Fact referencing a pack entity. */
export const FactSchema = z
  .object({
    id: z.string().min(1).max(128),
    entityId: z.string().min(1).max(128),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type Fact = z.infer<typeof FactSchema>;

/** Rule referencing registered primitives and pack entries. */
export const RuleSchema = z
  .object({
    id: z.string().min(1).max(128),
    primitive: z.string().min(1).max(64),
    entityIds: z.array(z.string().min(1).max(128)).default([]),
    factIds: z.array(z.string().min(1).max(128)).default([]),
    authorityRefIds: z.array(z.string().min(1).max(128)).default([]),
  })
  .strict();

export type Rule = z.infer<typeof RuleSchema>;

/** Pack time model instance referencing a registered time model id. */
export const TimeModelEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
    model: z.string().min(1).max(64),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type TimeModelEntry = z.infer<typeof TimeModelEntrySchema>;

/** Pack identity strategy instance referencing a registered strategy id. */
export const IdentityStrategyEntrySchema = z
  .object({
    id: z.string().min(1).max(128),
    strategy: z.string().min(1).max(64),
    label: z.string().min(1).max(256).optional(),
  })
  .strict();

export type IdentityStrategyEntry = z.infer<typeof IdentityStrategyEntrySchema>;

/** Question with text subject to question-language registry validation. */
export const QuestionSchema = z
  .object({
    id: z.string().min(1).max(128),
    text: z.string().min(1).max(4096),
  })
  .strict();

export type Question = z.infer<typeof QuestionSchema>;
