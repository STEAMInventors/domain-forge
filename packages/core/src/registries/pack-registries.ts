import type { DomainPackV0 } from '@hive/pack-contract';
import { createHash } from 'node:crypto';
import { assertRegistryReferences } from './registry.js';
import { RegistryError } from './registry-error.js';
import {
  ArchetypeRegistry,
  CompositionRegistry,
  GrammarRegistry,
  IdentityStrategyRegistry,
  PrimitiveRegistry,
  TimeModelRegistry,
} from './system-registries.js';

export type PackRegistrySection =
  | 'authorityReferences'
  | 'documentTypes'
  | 'vocabulary'
  | 'entities'
  | 'facts'
  | 'extractionContracts'
  | 'outputSpecifications'
  | 'rules'
  | 'questions'
  | 'timeModels'
  | 'identityStrategies';

const PACK_REGISTRY_SECTIONS: readonly PackRegistrySection[] = [
  'authorityReferences',
  'documentTypes',
  'vocabulary',
  'entities',
  'facts',
  'extractionContracts',
  'outputSpecifications',
  'rules',
  'questions',
  'timeModels',
  'identityStrategies',
];

export interface PackEntryRegistry<T extends { id: string }> {
  readonly section: PackRegistrySection;
  readonly entries: readonly T[];
  resolve(id: string): T;
  has(id: string): boolean;
  list(): readonly T[];
}

export interface PackRegistries {
  readonly packId: string;
  readonly packVersion: string;
  readonly authorityReferences: PackEntryRegistry<DomainPackV0['authorityReferences'][number]>;
  readonly documentTypes: PackEntryRegistry<DomainPackV0['documentTypes'][number]>;
  readonly vocabulary: PackEntryRegistry<DomainPackV0['vocabulary'][number]>;
  readonly entities: PackEntryRegistry<DomainPackV0['entities'][number]>;
  readonly facts: PackEntryRegistry<DomainPackV0['facts'][number]>;
  readonly extractionContracts: PackEntryRegistry<DomainPackV0['extractionContracts'][number]>;
  readonly outputSpecifications: PackEntryRegistry<DomainPackV0['outputSpecifications'][number]>;
  readonly rules: PackEntryRegistry<DomainPackV0['rules'][number]>;
  readonly questions: PackEntryRegistry<DomainPackV0['questions'][number]>;
  readonly timeModels: PackEntryRegistry<DomainPackV0['timeModels'][number]>;
  readonly identityStrategies: PackEntryRegistry<DomainPackV0['identityStrategies'][number]>;
  getFingerprint(): string;
  validateCrossReferences(): void;
}

function buildPackEntryRegistry<T extends { id: string }>(
  section: PackRegistrySection,
  entries: readonly T[],
): PackEntryRegistry<T> {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map<string, T>();

  for (const entry of sorted) {
    if (!entry.id) {
      throw new RegistryError(`Malformed entry in pack section "${section}"`, {
        registry: `pack.${section}`,
        code: 'REGISTRY_MALFORMED_ENTRY',
      });
    }
    if (byId.has(entry.id)) {
      throw new RegistryError(`Duplicate id "${entry.id}" in pack section "${section}"`, {
        registry: `pack.${section}`,
        code: 'REGISTRY_DUPLICATE_ID',
        entryId: entry.id,
      });
    }
    byId.set(entry.id, entry);
  }

  return Object.freeze({
    section,
    entries: Object.freeze([...sorted]),
    resolve(id: string): T {
      const entry = byId.get(id);
      if (!entry) {
        throw new RegistryError(`Unknown entry "${id}" in pack section "${section}"`, {
          registry: `pack.${section}`,
          code: 'REGISTRY_UNKNOWN_ENTRY',
          entryId: id,
        });
      }
      return entry;
    },
    has(id: string): boolean {
      return byId.has(id);
    },
    list(): readonly T[] {
      return Object.freeze([...sorted]);
    },
  });
}

/** Build immutable pack-defined registries from composed pack content. */
export function createPackRegistries(pack: DomainPackV0): PackRegistries {
  const registries = {} as Record<PackRegistrySection, PackEntryRegistry<{ id: string }>>;

  for (const section of PACK_REGISTRY_SECTIONS) {
    registries[section] = buildPackEntryRegistry(section, pack[section]);
  }

  const result: PackRegistries = {
    packId: pack.packId,
    packVersion: pack.packVersion,
    authorityReferences: registries.authorityReferences as PackRegistries['authorityReferences'],
    documentTypes: registries.documentTypes as PackRegistries['documentTypes'],
    vocabulary: registries.vocabulary as PackRegistries['vocabulary'],
    entities: registries.entities as PackRegistries['entities'],
    facts: registries.facts as PackRegistries['facts'],
    extractionContracts: registries.extractionContracts as PackRegistries['extractionContracts'],
    outputSpecifications: registries.outputSpecifications as PackRegistries['outputSpecifications'],
    rules: registries.rules as PackRegistries['rules'],
    questions: registries.questions as PackRegistries['questions'],
    timeModels: registries.timeModels as PackRegistries['timeModels'],
    identityStrategies: registries.identityStrategies as PackRegistries['identityStrategies'],

    getFingerprint(): string {
      const payload = Object.fromEntries(
        PACK_REGISTRY_SECTIONS.map((section) => [
          section,
          registries[section].list().map((e) => e.id),
        ]),
      );
      return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
    },

    validateCrossReferences(): void {
      validatePackRegistryCrossReferences(pack, result);
    },
  };

  return Object.freeze(result);
}

function assertPackEntryReferences(
  sourceRegistry: string,
  references: readonly string[],
  target: PackEntryRegistry<{ id: string }>,
  context?: { entryId?: string; field?: string },
): void {
  for (const ref of references) {
    if (!target.has(ref)) {
      throw new RegistryError(`Invalid reference "${ref}" to ${target.section}`, {
        registry: sourceRegistry,
        code: 'REGISTRY_INVALID_REFERENCE',
        reference: ref,
        referenceRegistry: `pack.${target.section}`,
        ...(context?.entryId !== undefined ? { entryId: context.entryId } : {}),
        ...(context?.field !== undefined ? { field: context.field } : {}),
      });
    }
  }
}

function validatePackRegistryCrossReferences(pack: DomainPackV0, registries: PackRegistries): void {
  for (const entity of pack.entities) {
    assertRegistryReferences('pack.entities', [entity.grammarType], GrammarRegistry, {
      entryId: entity.id,
      field: 'grammarType',
    });
  }

  for (const tm of pack.timeModels) {
    assertRegistryReferences('pack.timeModels', [tm.model], TimeModelRegistry, {
      entryId: tm.id,
      field: 'model',
    });
  }

  for (const is of pack.identityStrategies) {
    assertRegistryReferences('pack.identityStrategies', [is.strategy], IdentityStrategyRegistry, {
      entryId: is.id,
      field: 'strategy',
    });
  }

  for (const rule of pack.rules) {
    assertRegistryReferences('pack.rules', [rule.primitive], PrimitiveRegistry, {
      entryId: rule.id,
      field: 'primitive',
    });
    assertPackEntryReferences('pack.rules', rule.entityIds, registries.entities, {
      entryId: rule.id,
      field: 'entityIds',
    });
    assertPackEntryReferences('pack.rules', rule.factIds, registries.facts, {
      entryId: rule.id,
      field: 'factIds',
    });
    assertPackEntryReferences('pack.rules', rule.authorityRefIds, registries.authorityReferences, {
      entryId: rule.id,
      field: 'authorityRefIds',
    });
  }

  for (const fact of pack.facts) {
    assertPackEntryReferences('pack.facts', [fact.entityId], registries.entities, {
      entryId: fact.id,
      field: 'entityId',
    });
  }

  for (const contract of pack.extractionContracts) {
    assertPackEntryReferences('pack.extractionContracts', [contract.factId], registries.facts, {
      entryId: contract.id,
      field: 'factId',
    });
    if (contract.entityId !== undefined) {
      assertPackEntryReferences('pack.extractionContracts', [contract.entityId], registries.entities, {
        entryId: contract.id,
        field: 'entityId',
      });
    }
    assertPackEntryReferences(
      'pack.extractionContracts',
      contract.documentTypeIds,
      registries.documentTypes,
      { entryId: contract.id, field: 'documentTypeIds' },
    );
    for (const field of ['constructId', 'roleId', 'subjectId', 'unitId'] as const) {
      const termId = contract[field];
      if (termId !== undefined) {
        assertPackEntryReferences('pack.extractionContracts', [termId], registries.vocabulary, {
          entryId: contract.id,
          field,
        });
      }
    }
    assertPackEntryReferences(
      'pack.extractionContracts',
      contract.vocabularyRefs,
      registries.vocabulary,
      { entryId: contract.id, field: 'vocabularyRefs' },
    );
    for (const hint of contract.identityHints) {
      if (hint.entityId !== undefined) {
        assertPackEntryReferences('pack.extractionContracts', [hint.entityId], registries.entities, {
          entryId: contract.id,
          field: 'identityHints.entityId',
        });
      }
    }
    for (const constraint of contract.phrasingConstraints) {
      assertPackEntryReferences(
        'pack.extractionContracts',
        constraint.factIds,
        registries.facts,
        { entryId: contract.id, field: 'phrasingConstraints.factIds' },
      );
    }
  }

  if (pack.composition.strategy !== undefined) {
    CompositionRegistry.assert(pack.composition.strategy);
  }
  if (pack.composition.archetype !== undefined) {
    ArchetypeRegistry.assert(pack.composition.archetype);
  }
}
