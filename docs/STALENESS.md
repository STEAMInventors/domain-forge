# Pack Staleness

## Binding

Certified pack bound to authority corpus hash.

## StalenessEvaluator

Abstraction with event hooks. No scheduler in bootstrap.

## Reasons

- SOURCE_CONTENT_CHANGED
- EFFECTIVE_DATE_BOUNDARY_REACHED
- SOURCE_UNAVAILABLE
- AUTHORITY_SUPERSEDED
- CORPUS_REQUALIFICATION_REQUIRED

## Transition

When staleness proven: `CERTIFIED → SUSPENDED`. Pack bytes not mutated. Requalification produces new corpus/run/version.

Implemented in `@domain-forge/packs/staleness.ts`.
