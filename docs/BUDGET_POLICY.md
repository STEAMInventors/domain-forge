# Budget Policy

## Run Budgets

Every ForgeRun has explicit limits:

- max model invocations
- max input/output/total tokens
- optional max monetary cost
- max retry attempts
- max Stage 6↔7 review rounds

## Enforcement

`checkBudget` called before/after model invocations. Exceeding hard budget → `BUDGET_EXCEEDED`, run → `BLOCKED`.

## Configuration

Default budget: `configs/budgets/default.json`

Human action may resume with new budget decision (recorded separately).
