# Agent Instructions for Domain Forge

AI coding agents working in this repository must follow these rules.

## Before Architectural Work

1. Read `docs/ARCHITECTURE.md` and `docs/GUARDRAILS.md`.

## Hard Prohibitions

2. Never add domain-specific behavior to generic Forge code.
3. Never create a second private Domain Pack schema.
4. Use `@hive/pack-contract` for all pack schema work.
5. Never bypass validation because model output looks reasonable.
6. Never convert UNKNOWN into a guessed value.
7. Never silently weaken a guardrail.
8. Never add a primitive, grammar type, archetype, composition strategy, time model, identity strategy, or outcome without explicit architecture review (ADR).
9. Never allow a model to certify output.
10. Never bypass Stage 0 human approval.
11. Never allow Stage 7 to use the same model identity as Stage 6 without an ADR.
12. Never give stages more input than their declared projection.
13. Never use provider-native web retrieval for authoritative research.
14. Every authoritative source must be retrieved and snapshotted by Forge.
15. Preserve immutable execution history — never overwrite failed attempts.
16. Preserve certification-to-pack-hash binding.
17. Prefer deterministic code over model reasoning whenever deterministic validation is possible.
18. Any architectural exception requires an ADR in `docs/ADR/`.

## Dependency Direction

`@hive/pack-contract` must never import Forge packages. See `docs/ARCHITECTURE.md`.

## Testing

No live LLM calls in ordinary tests. Use fake providers.
