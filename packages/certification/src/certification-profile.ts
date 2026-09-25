import { REVIEWER_ROLE_DEFINITIONS } from '@domain-forge/core';
import type { CertificationProfile, CertificationProfileLoader } from '@domain-forge/contracts';
import { z } from 'zod';

const CompletenessValidatorSchema = z.enum([
  'extraction-contract-completeness',
  'output-specification-completeness',
]);

const ReviewerRoleSchema = z.enum(
  REVIEWER_ROLE_DEFINITIONS.map((r) => r.id) as [string, ...string[]],
);

export const CertificationProfileSchema = z
  .object({
    id: z.string().min(1).max(128),
    version: z.string().min(1).max(64),
    requiredQualificationProfiles: z
      .array(
        z
          .object({
            id: z.string().min(1).max(128),
            version: z.string().min(1).max(64),
          })
          .strict(),
      )
      .min(1),
    layerARequired: z.boolean().default(true),
    layerBRequired: z.boolean().default(false),
    requiredReviewerRoles: z.array(ReviewerRoleSchema).min(1),
    requiredCompletenessValidators: z.array(CompletenessValidatorSchema).default([
      'extraction-contract-completeness',
      'output-specification-completeness',
    ]),
    permitUnresolvedReviewItems: z.boolean().default(false),
  })
  .strict();

export function parseCertificationProfile(input: unknown): CertificationProfile {
  return CertificationProfileSchema.parse(input) as CertificationProfile;
}

export function createCertificationProfileLoader(
  profiles: readonly CertificationProfile[],
): CertificationProfileLoader {
  const index = new Map<string, CertificationProfile>();
  for (const profile of profiles) {
    index.set(`${profile.id}\u0000${profile.version}`, profile);
  }

  return {
    load(profileId: string, profileVersion: string): CertificationProfile | undefined {
      return index.get(`${profileId}\u0000${profileVersion}`);
    },
  };
}
