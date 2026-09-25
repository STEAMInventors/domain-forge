import { createHash } from 'node:crypto';
import { canonicalizeJson } from './canonical/jcs-v1.js';
import type { PackDependencyRef } from './dependencies.js';
import { PackDependencyRefSchema } from './dependencies.js';
import { parseDomainPackV0, type DomainPackV0 } from './domain-pack-v0.js';
import { PackCompositionError } from './composition-errors.js';
import {
  PACK_COMPOSITION_MANIFEST_SCHEMA_VERSION,
  type PackCompositionLayer,
  type PackCompositionLayerRole,
  type PackCompositionManifest,
} from './composition-manifest.js';
import { computePackContentHash } from './pack-content-hash.js';
import {
  RESERVED_PACK_SECTIONS,
  type ReservedCompositionConfig,
  type ReservedPackSectionName,
} from './reserved-sections.js';

export const LIST_PACK_SECTIONS = RESERVED_PACK_SECTIONS.filter(
  (section): section is Exclude<ReservedPackSectionName, 'composition'> => section !== 'composition',
);

type SectionArrays = Record<(typeof LIST_PACK_SECTIONS)[number], DomainPackV0[(typeof LIST_PACK_SECTIONS)[number]]>;

interface ResolvedPackSections {
  sections: SectionArrays;
  composition: ReservedCompositionConfig;
}

export type PackResolutionSet = ReadonlyMap<string, DomainPackV0>;

export interface ComposedDomainPackResult {
  pack: DomainPackV0;
  manifest: PackCompositionManifest;
  packCompositionHash: string;
}

/** Deterministic resolution-set key for an exact dependency reference. */
export function dependencyRefKey(ref: PackDependencyRef): string {
  return `${ref.packId}\u0000${ref.packVersion}\u0000${ref.packContentHash}`;
}

/** Pack identity key used for cycle detection (hash-independent). */
export function packIdentityKey(ref: Pick<PackDependencyRef, 'packId' | 'packVersion'>): string {
  return `${ref.packId}\u0000${ref.packVersion}`;
}

/** Build a dependency reference from validated pack content. */
export function packToDependencyRef(pack: DomainPackV0): PackDependencyRef {
  return {
    packId: pack.packId,
    packVersion: pack.packVersion,
    packContentHash: computePackContentHash(pack),
  };
}

/** Compute deterministic SHA-256 hash of a composition manifest. */
export function computePackCompositionHash(manifest: PackCompositionManifest): string {
  const canonical = canonicalizeJson(manifest);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Resolve and compose a root pack with its declared dependencies. */
export function composeDomainPack(
  rootPackInput: DomainPackV0 | unknown,
  resolutionSet: PackResolutionSet,
): ComposedDomainPackResult {
  const rootPack = parseDomainPackV0(rootPackInput);
  const rootRef = packToDependencyRef(rootPack);

  const layers: PackCompositionLayer[] = [];
  const orderRef = { value: 0 };
  const visiting = new Set<string>();

  const merged: ResolvedPackSections = {
    sections: createEmptySectionArrays(),
    composition: {},
  };

  mergeSharedDependencies(rootPack, resolutionSet, visiting, layers, orderRef, merged);
  mergeExtendsDependencies(rootPack, resolutionSet, visiting, layers, orderRef, merged);
  mergeOverrideSections(merged.sections, extractSectionArrays(rootPack));
  mergeOverrideComposition(merged.composition, rootPack.composition);
  appendLayer(layers, orderRef, 'root', rootRef);

  for (const overlayRef of rootPack.dependencies.overlay) {
    assertNoCompositionCycle(overlayRef, visiting);
    const overlayPack = lookupDependency(overlayRef, resolutionSet);
    const overlayContent = resolvePackContent(
      overlayRef,
      overlayPack,
      resolutionSet,
      visiting,
      layers,
      orderRef,
    );
    mergeOverrideSections(merged.sections, overlayContent.sections);
    mergeOverrideComposition(merged.composition, overlayContent.composition);
    appendLayer(layers, orderRef, 'overlay', overlayRef);
  }

  const manifest: PackCompositionManifest = {
    schemaVersion: PACK_COMPOSITION_MANIFEST_SCHEMA_VERSION,
    root: rootRef,
    layers,
  };

  return {
    pack: parseDomainPackV0({
      ...rootPack,
      ...merged.sections,
      composition: merged.composition,
    }),
    manifest,
    packCompositionHash: computePackCompositionHash(manifest),
  };
}

function assertNoCompositionCycle(ref: PackDependencyRef, visiting: Set<string>): void {
  const identityKey = packIdentityKey(ref);
  if (visiting.has(identityKey)) {
    throw new PackCompositionError(
      'COMPOSITION_CYCLE_DETECTED',
      `Circular composition dependency detected at ${ref.packId}@${ref.packVersion}`,
      `dependencies.${ref.packId}`,
      { packId: ref.packId, packVersion: ref.packVersion },
    );
  }
}

function mergeSharedDependencies(
  pack: DomainPackV0,
  resolutionSet: PackResolutionSet,
  visiting: Set<string>,
  layers: PackCompositionLayer[],
  orderRef: { value: number },
  target: ResolvedPackSections,
): void {
  for (const sharedRef of sortDependencyRefs(pack.dependencies.shared)) {
    assertNoCompositionCycle(sharedRef, visiting);
    const sharedPack = lookupDependency(sharedRef, resolutionSet);
    const sharedContent = resolvePackContent(
      sharedRef,
      sharedPack,
      resolutionSet,
      visiting,
      layers,
      orderRef,
    );
    mergeSharedSections(target.sections, sharedContent.sections, sharedRef);
    mergeSharedComposition(target.composition, sharedContent.composition, sharedRef);
    appendLayer(layers, orderRef, 'shared', sharedRef);
  }
}

function mergeExtendsDependencies(
  pack: DomainPackV0,
  resolutionSet: PackResolutionSet,
  visiting: Set<string>,
  layers: PackCompositionLayer[],
  orderRef: { value: number },
  target: ResolvedPackSections,
): void {
  for (const extendsRef of pack.dependencies.extends) {
    assertNoCompositionCycle(extendsRef, visiting);
    const extendsPack = lookupDependency(extendsRef, resolutionSet);
    const extendsContent = resolvePackContent(
      extendsRef,
      extendsPack,
      resolutionSet,
      visiting,
      layers,
      orderRef,
    );
    mergeOverrideSections(target.sections, extendsContent.sections);
    mergeOverrideComposition(target.composition, extendsContent.composition);
    appendLayer(layers, orderRef, 'extends', extendsRef);
  }
}

function resolvePackContent(
  ref: PackDependencyRef,
  pack: DomainPackV0,
  resolutionSet: PackResolutionSet,
  visiting: Set<string>,
  layers: PackCompositionLayer[],
  orderRef: { value: number },
): ResolvedPackSections {
  assertNoCompositionCycle(ref, visiting);

  const identityKey = packIdentityKey(ref);
  visiting.add(identityKey);
  try {
    const resolved: ResolvedPackSections = {
      sections: createEmptySectionArrays(),
      composition: {},
    };

    mergeSharedDependencies(pack, resolutionSet, visiting, layers, orderRef, resolved);
    mergeExtendsDependencies(pack, resolutionSet, visiting, layers, orderRef, resolved);
    mergeOverrideSections(resolved.sections, extractSectionArrays(pack));
    mergeOverrideComposition(resolved.composition, pack.composition);

    return resolved;
  } finally {
    visiting.delete(identityKey);
  }
}

function createEmptySectionArrays(): SectionArrays {
  const sections = {} as SectionArrays;
  for (const section of LIST_PACK_SECTIONS) {
    sections[section] = [];
  }
  return sections;
}

function extractSectionArrays(pack: DomainPackV0): SectionArrays {
  return Object.fromEntries(LIST_PACK_SECTIONS.map((section) => [section, [...pack[section]]])) as SectionArrays;
}

function lookupDependency(ref: PackDependencyRef, resolutionSet: PackResolutionSet): DomainPackV0 {
  const parsedRef = parseDependencyRef(ref);
  const exactKey = dependencyRefKey(parsedRef);
  let pack = resolutionSet.get(exactKey);

  if (!pack) {
    for (const candidate of resolutionSet.values()) {
      if (
        candidate.packId === parsedRef.packId &&
        candidate.packVersion === parsedRef.packVersion
      ) {
        pack = candidate;
        break;
      }
    }
  }

  if (!pack) {
    throw new PackCompositionError(
      'DEPENDENCY_NOT_FOUND',
      `Dependency not found in resolution set: ${parsedRef.packId}@${parsedRef.packVersion}#${parsedRef.packContentHash}`,
      `dependencies.${parsedRef.packId}`,
      { packId: parsedRef.packId, packVersion: parsedRef.packVersion },
    );
  }

  const validated = parseDomainPackV0(pack);
  assertDependencyIdentity(validated, parsedRef);

  const actualHash = computePackContentHash(validated);
  if (actualHash !== parsedRef.packContentHash) {
    throw new PackCompositionError(
      'DEPENDENCY_HASH_MISMATCH',
      `Dependency hash mismatch for ${parsedRef.packId}@${parsedRef.packVersion}: expected ${parsedRef.packContentHash}, got ${actualHash}`,
      `dependencies.${parsedRef.packId}`,
      { expected: parsedRef.packContentHash, actual: actualHash },
    );
  }

  return validated;
}

function parseDependencyRef(ref: PackDependencyRef): PackDependencyRef {
  const parsed = PackDependencyRefSchema.safeParse(ref);
  if (!parsed.success) {
    throw new PackCompositionError(
      'DEPENDENCY_MALFORMED',
      `Malformed dependency reference: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      'dependencies',
    );
  }
  return parsed.data;
}

export function assertDependencyIdentity(pack: DomainPackV0, ref: PackDependencyRef): void {
  if (pack.packId !== ref.packId || pack.packVersion !== ref.packVersion) {
    throw new PackCompositionError(
      'DEPENDENCY_IDENTITY_MISMATCH',
      `Dependency identity mismatch: reference ${ref.packId}@${ref.packVersion}, resolved ${pack.packId}@${pack.packVersion}`,
      `dependencies.${ref.packId}`,
      {
        expected: { packId: ref.packId, packVersion: ref.packVersion },
        actual: { packId: pack.packId, packVersion: pack.packVersion },
      },
    );
  }
}

function sortDependencyRefs(refs: PackDependencyRef[]): PackDependencyRef[] {
  return [...refs].sort((a, b) => {
    const byId = a.packId.localeCompare(b.packId);
    if (byId !== 0) return byId;
    const byVersion = a.packVersion.localeCompare(b.packVersion);
    if (byVersion !== 0) return byVersion;
    return a.packContentHash.localeCompare(b.packContentHash);
  });
}

function appendLayer(
  layers: PackCompositionLayer[],
  orderRef: { value: number },
  role: PackCompositionLayerRole,
  ref: PackDependencyRef,
): void {
  layers.push({
    role,
    packId: ref.packId,
    packVersion: ref.packVersion,
    packContentHash: ref.packContentHash,
    order: orderRef.value,
  });
  orderRef.value += 1;
}

function mergeSharedSections(
  target: SectionArrays,
  source: SectionArrays,
  sharedRef: PackDependencyRef,
): void {
  for (const section of LIST_PACK_SECTIONS) {
    mergeSectionEntries(target[section], source[section], 'shared', section, sharedRef);
  }
}

function mergeOverrideSections(target: SectionArrays, source: SectionArrays): void {
  for (const section of LIST_PACK_SECTIONS) {
    mergeSectionEntries(target[section], source[section], 'override', section);
  }
}

type MergeMode = 'shared' | 'override';

function mergeSectionEntries<T extends { id: string }>(
  target: T[],
  source: T[],
  mode: MergeMode,
  section: (typeof LIST_PACK_SECTIONS)[number],
  sharedRef?: PackDependencyRef,
): void {
  const indexById = new Map(target.map((entry, index) => [entry.id, index]));

  for (const entry of source) {
    const existingIndex = indexById.get(entry.id);
    if (existingIndex === undefined) {
      indexById.set(entry.id, target.length);
      target.push(entry);
      continue;
    }

    const existing = target[existingIndex];
    if (entriesEqual(existing, entry)) {
      continue;
    }

    if (mode === 'shared') {
      throw new PackCompositionError(
        'COMPOSITION_CONFLICT',
        `Shared dependency conflict in section "${section}" for id "${entry.id}"`,
        `${section}.${entry.id}`,
        {
          packId: sharedRef?.packId,
          packVersion: sharedRef?.packVersion,
          existing,
          incoming: entry,
        },
      );
    }

    target[existingIndex] = entry;
  }
}

function mergeSharedComposition(
  target: ReservedCompositionConfig,
  source: ReservedCompositionConfig,
  sharedRef: PackDependencyRef,
): void {
  mergeCompositionEntries(target, source, 'shared', sharedRef);
}

function mergeOverrideComposition(
  target: ReservedCompositionConfig,
  source: ReservedCompositionConfig,
): void {
  mergeCompositionEntries(target, source, 'override');
}

function mergeCompositionEntries(
  target: ReservedCompositionConfig,
  source: ReservedCompositionConfig,
  mode: MergeMode,
  sharedRef?: PackDependencyRef,
): void {
  for (const key of Object.keys(source).sort() as (keyof ReservedCompositionConfig)[]) {
    const incoming = source[key];
    if (incoming === undefined) {
      continue;
    }
    const existing = target[key];
    if (existing === undefined) {
      target[key] = incoming;
      continue;
    }
    if (existing === incoming) {
      continue;
    }
    if (mode === 'shared') {
      throw new PackCompositionError(
        'COMPOSITION_CONFLICT',
        `Shared dependency conflict in composition.${String(key)}`,
        `composition.${String(key)}`,
        { packId: sharedRef?.packId, packVersion: sharedRef?.packVersion, existing, incoming },
      );
    }
    target[key] = incoming;
  }
}

function entriesEqual(a: unknown, b: unknown): boolean {
  return canonicalizeJson(a) === canonicalizeJson(b);
}
