# Domain Forge Guardrails

## Hard Rules

1. LLM output is always untrusted.
2. Valid JSON ≠ valid domain logic.
3. No domain-specific rule in generic Forge code.
4. No domain-specific rule in Hive Core.
5. UNKNOWN is preferable to inference.
6. Missing evidence is preferable to fabricated evidence.
7. Every executable rule must trace to stored authority.
8. Every certification must bind to exact immutable pack hash.
9. Every stage receives only explicitly projected input fields.
10. No model certifies its own output.
11. Domain Packs are declarative data, never arbitrary executable code.

## Enforcement Points

| Guardrail | Enforced By |
|-----------|-------------|
| Stage 0 human gate | `executeStage` checks `hasStage0Approval` |
| Input projection | `projectStageInput` deny-by-default |
| Stage 7 independence | `StageIndependenceValidator` |
| Provisional gate | `ProvisionalReadinessValidator` |
| Certification hash binding | `CertificationValidator` |
| Budget caps | `checkBudget` in stage runtime |
| Unknown primitives | `PrimitiveRegistry.assert` |
| Quote verification | `normalizeQuoteV0` + `verifyQuote` |
| Forge-controlled fetch | `SearchProvider` / `SourceRetriever` interfaces |
| Immutable attempts | `StageAttempt` append-only in execution |

## Fail-Closed Semantics

Blocking failures stop automatic progression: `FAILED_VALIDATION`, `NEEDS_REVIEW`, `BLOCKED_CAPABILITY`, `EVIDENCE_VERIFICATION_FAILED`, `INDEPENDENCE_VALIDATION_FAILED`, `BUDGET_EXCEEDED`.

No silent repair. No guessing.

## Agent Prohibitions

See `AGENTS.md` for AI coding agent instructions.
