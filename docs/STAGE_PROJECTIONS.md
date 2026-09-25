# Stage Input Projections

## Deny-by-Default

Each `ForgeStageDefinition` declares:

- `inputProjection.allowedArtifactTypes`
- `inputProjection.allowedFields`

The orchestrator builds projected input from approved fields only. Undeclared artifact types are rejected.

## Examples

### Stage 7 (Adversarial Review)

**May receive:** validated Stage 6 rule artifact, authority corpus sections, cross-references

**Must NOT receive:** Stage 6 raw model response, hidden reasoning, scratch data, unrelated artifacts

### Stage 8 (Fixtures)

**May receive:** structure, document landscape, rule ID, trigger, exceptions, required facts

**Must NOT receive:** final user-facing question wording

## Provenance

Every execution records `projectedInputHash` for audit.

## Enforcement

`projectStageInput` in `@domain-forge/validation` — tested in `tests/architecture/stage-projection.test.ts`.
