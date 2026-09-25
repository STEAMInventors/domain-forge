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


## Production Providers

Production configuration is loaded explicitly from environment variables through
`createProductionModelRuntimeFromEnv`. OpenAI and Anthropic are isolated behind
`ModelProvider` adapters and selected by the existing policy aliases.

Provider-native tools remain disabled. API keys are read from environment variables only.
Model identifiers must be explicit and may not contain `latest`. Optional explicit
`modelVersion` metadata is included in deterministic model identity/config hashing.
Ordinary tests continue to use `FakeModelProvider`; live model calls are not part of the test suite.
