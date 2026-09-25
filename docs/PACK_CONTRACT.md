# Pack Contract

## Shared Contract

Domain Pack schema lives in `@hive/pack-contract` — not in Forge-private code.

Both Domain Forge and Hive Core import this package.

`@hive/pack-contract` must not depend on Forge packages.

## Bootstrap Step 5 Scope

The current implementation covers foundational identity, version, and metadata only:

- `PackIdentity` — `packId`, `domainId`
- `PackVersionMetadata` — `schemaVersion`, `packVersion` (semver)
- `PackScope` — `scope`, `jurisdiction`
- `PackDependencies` — exact `extends` / `overlay` / `shared` references by `packId`, `packVersion`, and `packContentHash`
- `PackManifest` — combined foundational manifest
- `DomainPackV0` — manifest plus reserved executable section boundaries

Not yet implemented in this package (later Section 59 steps):

- canonical pack hashing (`packContentHash` computation)
- composition resolution
- detailed section schemas (rules, facts, extraction contract, output specification, etc.)

## DomainPackV0

Minimum executable boundary at Step 5:

- schemaVersion, packId, domainId, packVersion
- scope, jurisdiction, dependencies
- optional description, labels, corpusHash
- reserved empty sections: authorityReferences, documentTypes, vocabulary, entities, facts, composition, timeModels, identityStrategies, rules, questions, capabilityRequirements, fixtureReferences, provenanceReferences

Reserved list sections currently accept only `{ id }` entry boundaries. Detailed schemas arrive in later bootstrap steps.

## Immutability

Pack lifecycle state is **not** part of pack bytes. `packContentHash` binding is implemented in a later bootstrap step.

## Rules

- JSON/YAML serializable
- Versioned schema validation (Zod)
- No arbitrary executable code
- Stable identifiers and references
- Strict schemas reject unknown top-level keys
- Dependency resolution is always exact — never by `latest`

See `packages/pack-contract/src/`.
