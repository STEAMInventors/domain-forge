# Error Handling

## Typed Errors

All Forge errors extend `ForgeError` with:

- `code` — stable error code
- `message` — safe message (no secrets)
- `runId`, `stageId`, `artifactId` — context where applicable
- `retryable` — whether retry is permitted
- `details` — structured details
- `cause` — underlying cause

## Error Categories

ConfigurationError, SchemaValidationError, SemanticValidationError, EvidenceVerificationError, SourceRetrievalError, SourceNormalizationError, ModelInvocationError, ModelOutputError, StageProjectionError, CapabilityGapError, StageExecutionError, BudgetExceededError, HumanGateRequiredError, CertificationError, PersistenceError, InvariantViolationError, HiveExecutionError, StalenessError

## Logging

Secrets redacted via `@domain-forge/observability` logger patterns.
