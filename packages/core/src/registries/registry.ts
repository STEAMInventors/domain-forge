import { createHash } from 'node:crypto';
import { RegistryError, type RegistryErrorCode } from './registry-error.js';

export interface RegistryEntryDefinition {
  readonly id: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly schemaVersion?: string;
}

export interface ResolvedRegistryEntry<T extends RegistryEntryDefinition = RegistryEntryDefinition> {
  readonly id: string;
  readonly definition: T;
}

export interface ImmutableRegistry<T extends RegistryEntryDefinition = RegistryEntryDefinition> {
  readonly name: string;
  readonly version?: string;
  readonly entries: readonly ResolvedRegistryEntry<T>[];
  resolve(idOrAlias: string): ResolvedRegistryEntry<T>;
  resolveOptional(idOrAlias: string): ResolvedRegistryEntry<T> | undefined;
  has(idOrAlias: string): boolean;
  list(): readonly ResolvedRegistryEntry<T>[];
  assert(idOrAlias: string): string;
  getFingerprint(): string;
}

export interface BuildRegistryOptions {
  version?: string;
}

function registryError(
  registry: string,
  code: RegistryErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): RegistryError {
  return new RegistryError(message, {
    registry,
    code,
    ...extra,
  });
}

function validateDefinition<T extends RegistryEntryDefinition>(
  registry: string,
  definition: T,
): void {
  if (!definition.id || typeof definition.id !== 'string') {
    throw registryError(registry, 'REGISTRY_MALFORMED_ENTRY', 'Registry entry missing id', {
      entryId: definition.id,
    });
  }
  if (!definition.description || typeof definition.description !== 'string') {
    throw registryError(registry, 'REGISTRY_MALFORMED_ENTRY', `Registry entry "${definition.id}" missing description`, {
      entryId: definition.id,
    });
  }
}

/** Build an immutable registry from explicit validated definitions. */
export function buildRegistry<T extends RegistryEntryDefinition>(
  name: string,
  definitions: readonly T[],
  options?: BuildRegistryOptions,
): ImmutableRegistry<T> {
  const byCanonicalId = new Map<string, ResolvedRegistryEntry<T>>();
  const aliasToId = new Map<string, string>();
  const ordered: ResolvedRegistryEntry<T>[] = [];

  const sortedDefinitions = [...definitions].sort((a, b) => a.id.localeCompare(b.id));

  for (const definition of sortedDefinitions) {
    validateDefinition(name, definition);

    if (byCanonicalId.has(definition.id)) {
      throw registryError(
        name,
        'REGISTRY_DUPLICATE_ID',
        `Duplicate registry id "${definition.id}" in ${name}`,
        { entryId: definition.id },
      );
    }

    const resolved: ResolvedRegistryEntry<T> = { id: definition.id, definition };
    byCanonicalId.set(definition.id, resolved);
    ordered.push(resolved);

    for (const alias of definition.aliases ?? []) {
      if (!alias || typeof alias !== 'string') {
        throw registryError(name, 'REGISTRY_MALFORMED_ENTRY', `Invalid alias for "${definition.id}"`, {
          entryId: definition.id,
          alias,
        });
      }
      const existing = aliasToId.get(alias);
      if (existing !== undefined && existing !== definition.id) {
        throw registryError(
          name,
          'REGISTRY_DUPLICATE_ALIAS',
          `Duplicate alias "${alias}" in ${name}`,
          { alias, entryId: definition.id },
        );
      }
      aliasToId.set(alias, definition.id);
    }
  }

  function resolveCanonicalId(idOrAlias: string): string | undefined {
    if (byCanonicalId.has(idOrAlias)) {
      return idOrAlias;
    }
    return aliasToId.get(idOrAlias);
  }

  const registry: ImmutableRegistry<T> = {
    name,
    ...(options?.version !== undefined ? { version: options.version } : {}),
    entries: Object.freeze([...ordered]),

    resolve(idOrAlias: string): ResolvedRegistryEntry<T> {
      const canonicalId = resolveCanonicalId(idOrAlias);
      if (canonicalId === undefined) {
        throw registryError(
          name,
          'REGISTRY_UNKNOWN_ENTRY',
          `Unknown ${name} entry: ${idOrAlias}`,
          { entryId: idOrAlias },
        );
      }
      return byCanonicalId.get(canonicalId)!;
    },

    resolveOptional(idOrAlias: string): ResolvedRegistryEntry<T> | undefined {
      const canonicalId = resolveCanonicalId(idOrAlias);
      return canonicalId === undefined ? undefined : byCanonicalId.get(canonicalId);
    },

    has(idOrAlias: string): boolean {
      return resolveCanonicalId(idOrAlias) !== undefined;
    },

    list(): readonly ResolvedRegistryEntry<T>[] {
      return registry.entries;
    },

    assert(idOrAlias: string): string {
      return registry.resolve(idOrAlias).id;
    },

    getFingerprint(): string {
      const payload = {
        name,
        version: options?.version,
        entries: sortedDefinitions.map((d) => ({
          id: d.id,
          description: d.description,
          aliases: d.aliases ? [...d.aliases].sort() : undefined,
          schemaVersion: d.schemaVersion,
        })),
      };
      const canonical = JSON.stringify(payload);
      return createHash('sha256').update(canonical, 'utf8').digest('hex');
    },
  };

  return Object.freeze(registry);
}

/** Validate that every reference resolves in the target registry. */
export function assertRegistryReferences(
  sourceRegistry: string,
  references: readonly string[],
  target: ImmutableRegistry,
  context?: { entryId?: string; field?: string },
): void {
  for (const ref of references) {
    if (!target.has(ref)) {
      throw registryError(
        sourceRegistry,
        'REGISTRY_INVALID_REFERENCE',
        `Invalid reference "${ref}" to ${target.name}`,
        {
          reference: ref,
          referenceRegistry: target.name,
          ...(context?.entryId !== undefined ? { entryId: context.entryId } : {}),
          ...(context?.field !== undefined ? { field: context.field } : {}),
        },
      );
    }
  }
}
