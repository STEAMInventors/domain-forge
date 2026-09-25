import type { SourceClassificationRegistry, SourceClassificationRule } from '@domain-forge/contracts';
import { SourceTierRegistry, RegistryError } from '@domain-forge/core';

export const DEFAULT_SOURCE_CLASSIFICATION_VERSION = '1.0.0';

/** Generic default classification rules — no domain-specific source knowledge. */
export const DEFAULT_SOURCE_CLASSIFICATION_RULES: readonly SourceClassificationRule[] = [
  {
    id: 'classify-primary-authority',
    description: 'Primary authority sources resolve to tier 1',
    priority: 10,
    match: { authorityCategory: 'primary' },
    tier: '1',
  },
  {
    id: 'classify-secondary-authority',
    description: 'Secondary authority sources resolve to tier 3',
    priority: 20,
    match: { authorityCategory: 'secondary' },
    tier: '3',
  },
  {
    id: 'classify-reference-authority',
    description: 'Reference sources resolve to tier 5',
    priority: 30,
    match: { authorityCategory: 'reference' },
    tier: '5',
  },
  {
    id: 'classify-web-snapshot-discovery',
    description: 'Web snapshots without authority classification resolve to tier 6',
    priority: 40,
    match: { sourceType: 'web_snapshot', authorityCategory: 'unknown' },
    tier: '6',
  },
];

function validateClassificationRule(rule: SourceClassificationRule): void {
  if (!rule.id || !rule.description) {
    throw new RegistryError('Malformed source classification rule', {
      registry: 'sourceClassification',
      code: 'REGISTRY_MALFORMED_ENTRY',
      entryId: rule.id,
    });
  }
  if (!SourceTierRegistry.has(rule.tier)) {
    throw new RegistryError(`Classification rule "${rule.id}" references unknown tier "${rule.tier}"`, {
      registry: 'sourceClassification',
      code: 'REGISTRY_INVALID_REFERENCE',
      entryId: rule.id,
      reference: rule.tier,
      referenceRegistry: 'sourceTier',
    });
  }
}

export function createSourceClassificationRegistry(
  rules: readonly SourceClassificationRule[] = DEFAULT_SOURCE_CLASSIFICATION_RULES,
  version: string = DEFAULT_SOURCE_CLASSIFICATION_VERSION,
): SourceClassificationRegistry {
  const seenIds = new Set<string>();
  const sorted = [...rules].sort((a, b) => {
    const byPriority = a.priority - b.priority;
    if (byPriority !== 0) return byPriority;
    return a.id.localeCompare(b.id);
  });

  for (const rule of sorted) {
    validateClassificationRule(rule);
    if (seenIds.has(rule.id)) {
      throw new RegistryError(`Duplicate classification rule id "${rule.id}"`, {
        registry: 'sourceClassification',
        code: 'REGISTRY_DUPLICATE_ID',
        entryId: rule.id,
      });
    }
    seenIds.add(rule.id);
  }

  return Object.freeze({ version, rules: Object.freeze([...sorted]) });
}

export const DefaultSourceClassificationRegistry = createSourceClassificationRegistry();
