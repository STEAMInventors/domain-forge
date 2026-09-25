import type {
  ExtractionQualificationResolver,
  ExtractionQualificationResolution,
  PackStatusResolver,
  PackStatusResolution,
  QualificationStalenessEvaluator,
} from '@domain-forge/contracts';
import type { PackId, PackVersionId } from '@domain-forge/core';
import type { ForgeRepositories } from './repositories.js';

export interface PersistenceResolverOptions {
  readonly qualificationStalenessEvaluator?: QualificationStalenessEvaluator;
}

export function createPackStatusResolver(repos: ForgeRepositories): PackStatusResolver {
  return {
    async resolve(packVersionId: PackVersionId): Promise<PackStatusResolution | undefined> {
      const packVersion = await repos.packVersions.get(packVersionId);
      if (packVersion === undefined) {
        return undefined;
      }

      const certifications = await repos.certifications.findByPackContentHash(
        packVersion.packId,
        packVersion.packContentHash,
      );
      const certificationRecord = certifications.find((c) => c.decision.kind === 'certified');

      return {
        packVersionId,
        packId: packVersion.packId,
        packContentHash: packVersion.packContentHash,
        lifecycleState: packVersion.state,
        ...(certificationRecord !== undefined ? { certificationRecord } : {}),
      };
    },
  };
}

export function createExtractionQualificationResolver(
  repos: ForgeRepositories,
  options?: PersistenceResolverOptions,
): ExtractionQualificationResolver {
  return {
    async resolve(
      packId: PackId,
      packContentHash: string,
      runtime,
    ): Promise<ExtractionQualificationResolution | undefined> {
      const records = await repos.qualifications.findByPackContentHash(packId, packContentHash);
      if (records.length === 0) {
        return {
          packId,
          packContentHash,
          state: 'NOT_TESTED',
          isStale: false,
        };
      }

      const sorted = [...records].sort((a, b) => b.executedAt.localeCompare(a.executedAt));
      const latest = sorted[0]!;
      const extraction = latest.extractionQualification;

      if (extraction === undefined) {
        return {
          packId,
          packContentHash,
          state: 'NOT_TESTED',
          qualificationRecord: latest,
          isStale: false,
        };
      }

      const runtimeMatches =
        extraction.hiveCoreVersion === runtime.hiveVersion &&
        extraction.extractionModelFamily === runtime.extractionModelFamily &&
        extraction.extractionModelVersion === runtime.extractionModelVersion &&
        extraction.extractionPolicyVersion === runtime.extractionPolicyVersion;

      let isStale = false;
      if (options?.qualificationStalenessEvaluator !== undefined) {
        const evaluation = options.qualificationStalenessEvaluator.evaluate(latest, {
          packContentHash,
          ...(runtime.packCompositionHash !== undefined
            ? { packCompositionHash: runtime.packCompositionHash }
            : {}),
          fixtureCorpusHash: latest.identity.fixtureCorpusHash,
          ...(latest.identity.authorityCorpusHash !== undefined
            ? { authorityCorpusHash: latest.identity.authorityCorpusHash }
            : {}),
          qualificationProfileId: latest.identity.qualificationProfileId,
          qualificationProfileVersion: latest.identity.qualificationProfileVersion,
          extractionRuntime: {
            hiveVersion: runtime.hiveVersion,
            extractionModelFamily: runtime.extractionModelFamily,
            extractionModelVersion: runtime.extractionModelVersion,
            extractionPolicyVersion: runtime.extractionPolicyVersion,
          },
        });
        isStale = evaluation.isStale;
      }

      const state = !runtimeMatches
        ? 'NOT_TESTED'
        : isStale
          ? 'STALE'
          : extraction.state;

      return {
        packId,
        packContentHash,
        state,
        qualificationRecord: latest,
        isStale,
      };
    },
  };
}
