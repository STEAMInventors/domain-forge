# Model Policy

## Abstraction

Provider-neutral interfaces: `ModelProvider`, `ModelRequest`, `ModelResponse`, `ModelPolicy`.

Orchestration never hard-codes provider-specific behavior.

## Policy Aliases

Configuration maps aliases to providers/models:

- `research.high_accuracy`
- `extraction.high_volume`
- `reasoning.deep`
- `adversarial.independent`
- `fixture.high_volume`

See `configs/models/policies.json` and `ModelPolicyRegistry`.

## Stage 7 Independence

Stage 7 model identity must differ from Stage 6. Enforced by `StageIndependenceValidator`.

## Bootstrap

`FakeModelProvider` for deterministic tests. No live LLM calls in ordinary tests.
