import type {
  SourceClassificationRegistry,
  SourceTierResolutionInput,
  SourceTierResolutionResult,
  SourceTierResolver,
} from '@domain-forge/contracts';
import { RegistryError, SourceTierRegistry } from '@domain-forge/core';
import { DefaultSourceClassificationRegistry } from './source-classification-registry.js';

function matchesRule(
  input: SourceTierResolutionInput,
  rule: SourceClassificationRegistry['rules'][number],
): boolean {
  const { match } = rule;
  if (match.sourceType !== undefined && input.sourceType !== match.sourceType) {
    return false;
  }
  if (match.authorityCategory !== undefined && input.authorityCategory !== match.authorityCategory) {
    return false;
  }
  return true;
}

export function createSourceTierResolver(
  classificationRegistry: SourceClassificationRegistry = DefaultSourceClassificationRegistry,
): SourceTierResolver {
  return {
    resolve(input: SourceTierResolutionInput): SourceTierResolutionResult {
      const proposedSourceTier = input.proposedSourceTier;

      for (const rule of classificationRegistry.rules) {
        if (matchesRule(input, rule)) {
          SourceTierRegistry.assert(rule.tier);
          return {
            ...(proposedSourceTier !== undefined ? { proposedSourceTier } : {}),
            resolvedSourceTier: rule.tier,
            ruleId: rule.id,
            resolved: true,
          };
        }
      }

      if (proposedSourceTier !== undefined) {
        if (!SourceTierRegistry.has(proposedSourceTier)) {
          return {
            proposedSourceTier,
            resolved: false,
          };
        }
        return {
          proposedSourceTier,
          resolvedSourceTier: SourceTierRegistry.assert(proposedSourceTier),
          resolved: true,
        };
      }

      return { resolved: false };
    },

    resolveOrThrow(input: SourceTierResolutionInput): SourceTierResolutionResult & { resolvedSourceTier: string } {
      const result = this.resolve(input);
      if (!result.resolved || result.resolvedSourceTier === undefined) {
        throw new RegistryError('Source tier could not be resolved', {
          registry: 'sourceTier',
          code: 'REGISTRY_UNKNOWN_ENTRY',
          ...(input.proposedSourceTier !== undefined
            ? { proposedSourceTier: input.proposedSourceTier }
            : {}),
        });
      }
      return result as SourceTierResolutionResult & { resolvedSourceTier: string };
    },
  };
}

export const DefaultSourceTierResolver = createSourceTierResolver();
