import { FIXTURE_CATEGORIES } from '@domain-forge/contracts';
import { REVIEWER_ROLE_DEFINITIONS } from '@domain-forge/core';
import type { QualificationProfile, QualificationProfileLoader } from '@domain-forge/contracts';
import { z } from 'zod';

const FixtureCategorySchema = z.enum(FIXTURE_CATEGORIES as unknown as [string, ...string[]]);
const MaterialClassSchema = z.enum(['synthetic', 'real_corpus']);
const CompletenessValidatorSchema = z.enum([
  'extraction-contract-completeness',
  'output-specification-completeness',
]);
const PackVersionStateSchema = z.enum([
  'DRAFT',
  'PROVISIONAL',
  'CERTIFIED',
  'SUSPENDED',
  'DEPRECATED',
  'ARCHIVED',
]);
const ExecutorTrustSchema = z.enum(['TEST', 'FAKE', 'REAL_HIVE']);
const ReviewerRoleSchema = z.enum(
  REVIEWER_ROLE_DEFINITIONS.map((r) => r.id) as [string, ...string[]],
);

export const QualificationProfileSchema = z
  .object({
    id: z.string().min(1).max(128),
    version: z.string().min(1).max(64),
    requiredFixtureCategories: z.array(FixtureCategorySchema).default([]),
    requiredMaterialClasses: z.array(MaterialClassSchema).default(['synthetic']),
    requiredValidatorIds: z.array(z.string().min(1)).default([]),
    requiredCompletenessValidators: z.array(CompletenessValidatorSchema).default([
      'extraction-contract-completeness',
      'output-specification-completeness',
    ]),
    permittedExclusions: z.array(z.string().min(1)).default([]),
    humanReviewRequirements: z
      .array(
        z
          .object({
            reviewerRole: ReviewerRoleSchema,
            requiredForCategories: z.array(FixtureCategorySchema).optional(),
          })
          .strict(),
      )
      .default([]),
    coverageRequirements: z
      .object({
        minSyntheticFixtures: z.number().int().nonnegative().optional(),
        minRealCorpusFixtures: z.number().int().nonnegative().optional(),
        minTotalFixtures: z.number().int().nonnegative().optional(),
        requireAllPackFixtureReferences: z.boolean().default(true),
      })
      .strict()
      .default({ requireAllPackFixtureReferences: true }),
    layerARequired: z.boolean().default(true),
    layerBRequired: z.boolean().default(false),
    requiredExecutionTrust: ExecutorTrustSchema.default('REAL_HIVE'),
    allowedPackVersionStates: z
      .array(PackVersionStateSchema)
      .default(['DRAFT', 'PROVISIONAL']),
  })
  .strict();

export function parseQualificationProfile(input: unknown): QualificationProfile {
  return QualificationProfileSchema.parse(input) as QualificationProfile;
}

export function createQualificationProfileLoader(
  profiles: readonly QualificationProfile[],
): QualificationProfileLoader {
  const index = new Map<string, QualificationProfile>();
  for (const profile of profiles) {
    index.set(`${profile.id}\u0000${profile.version}`, profile);
  }

  return {
    load(profileId: string, profileVersion: string): QualificationProfile | undefined {
      return index.get(`${profileId}\u0000${profileVersion}`);
    },
  };
}
