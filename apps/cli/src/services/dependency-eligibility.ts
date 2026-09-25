import { dependencyRefKey } from '@hive/pack-contract';
import { evaluateRuntimeEligibility } from '@domain-forge/certification';
import { asPackId } from '@domain-forge/core';
import { createPackStatusResolver } from '@domain-forge/persistence';
import type {
  PackVersion,
  RuntimeCapability,
  RuntimeEligibilityDecision,
} from '@domain-forge/contracts';
import type { ForgeRepositories } from '@domain-forge/persistence';
import type { CommandError } from '../types.js';

export interface DependencyEligibilityResult {
  readonly map: ReadonlyMap<string, RuntimeEligibilityDecision>;
  readonly errors: readonly CommandError[];
}

export async function resolveDependencyEligibility(
  repos: ForgeRepositories,
  packVersion: PackVersion,
  context: {
    readonly suppliedCapabilities: readonly RuntimeCapability[];
    readonly hiveVersion: string;
  },
): Promise<DependencyEligibilityResult> {
  const map = new Map<string, RuntimeEligibilityDecision>();
  const errors: CommandError[] = [];
  const statusResolver = createPackStatusResolver(repos);

  const dependencyLayers = [
    ...packVersion.packContent.dependencies.extends,
    ...packVersion.packContent.dependencies.overlay,
    ...packVersion.packContent.dependencies.shared,
  ];

  for (const dependency of dependencyLayers) {
    const key = dependencyRefKey(dependency);
    const depPackVersion = await repos.packVersions.getByContentHash({
      packId: asPackId(dependency.packId),
      packContentHash: dependency.packContentHash,
    });

    if (depPackVersion === undefined) {
      errors.push({
        code: 'DEPENDENCY_NOT_RESOLVED',
        message: `Dependency pack version not found for ${dependency.packId}@${dependency.packVersion}`,
        context: { dependencyKey: key, packContentHash: dependency.packContentHash },
      });
      continue;
    }

    const status = await statusResolver.resolve(depPackVersion.id);
    const decision = evaluateRuntimeEligibility(
      depPackVersion,
      status?.certificationRecord,
      {
        suppliedCapabilities: context.suppliedCapabilities,
        hiveVersion: context.hiveVersion,
      },
    );
    map.set(key, decision);
  }

  return { map, errors };
}
