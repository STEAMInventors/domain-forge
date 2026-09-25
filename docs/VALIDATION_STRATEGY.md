# Validation Strategy

## Principle

LLMs may identify possible semantic problems. Code enforces deterministic invariants.

## Validator Categories

- **Schema**: Zod parse against versioned schemas
- **Semantic**: entity/fact/reference integrity, registry enums
- **Evidence**: quote verification against normalized source text
- **Reference**: authority ref resolution
- **Registry**: primitives, archetypes, composition, time models, identity strategies
- **Projection**: stage input boundary enforcement
- **Independence**: Stage 7 model identity ≠ Stage 6
- **Budget**: resource cap enforcement
- **Capability gap**: no OPEN gaps for provisional
- **Fixture**: coverage and execution match
- **Provisional readiness**: all gate conditions
- **Certification**: hash binding

## Fail-Closed

Validators return `ValidationResult` with explicit errors. Blocking failures halt automatic progression.
