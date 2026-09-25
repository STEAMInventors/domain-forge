# Testing Strategy

## Categories

- Unit tests per package
- Pack contract tests
- Schema contract tests
- Validator tests
- Quote normalization/verification tests
- State machine tests
- Stage projection tests
- Stage independence tests
- Budget tests
- Architecture dependency tests
- Orchestration tests
- Provider/retriever mock tests
- Fixture execution contract tests
- Provisional gate tests
- Certification hash tests
- Staleness transition tests

## No Live LLM

All tests use `FakeModelProvider`, `FakeSearchProvider`, `FakeSourceRetriever`, `FakeHiveExecutor`.

## Conformance

Infrastructure in `@domain-forge/testing` for loading external packs against `@hive/pack-contract`.

Canonical IEP fixture: **pending import** — see `tests/conformance/iep-conformance.test.ts`.
