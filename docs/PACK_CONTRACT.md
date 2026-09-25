# Pack Contract

## Shared Contract

Domain Pack schema lives in `@hive/pack-contract` — not in Forge-private code.

Both Domain Forge and Hive Core import this package.

## DomainPackV0

Minimum executable boundary fields:

- schemaVersion, packId, domainId, packVersion
- scope, jurisdiction, corpusHash
- authorityReferences, documentTypes, vocabulary
- entities, facts, composition
- timeModels, identityStrategies
- rules, questions
- capabilityRequirements, fixtureReferences, provenanceReferences

## Immutability

Pack lifecycle state is **not** part of pack bytes. `packContentHash` is computed from canonical JSON of pack content.

## Rules

- JSON/YAML serializable
- Versioned schema validation (Zod)
- No arbitrary executable code
- Stable identifiers and references
- Registered primitives and structural values only

See `packages/pack-contract/src/domain-pack-v0.ts`.
