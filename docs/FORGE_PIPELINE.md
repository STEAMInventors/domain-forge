# Forge Pipeline

## Flow

```
Sources → Evidence Corpus → Domain Model → Draft Domain Pack
  → Adversarial Qualification → Synthetic Fixtures → Hive Execution
  → Provisional Pack → Human Certification → Certified Pack
```

## Stage Boundaries

Every model stage returns versioned JSON. Pipeline per stage:

1. Model output
2. Parse
3. Schema validation
4. Semantic validation
5. Evidence validation
6. Reference validation
7. Persist immutable validated artifact
8. Project approved fields
9. Downstream stage

Raw model responses are never consumed downstream.

## Stage 0 Hard Gate

Stage 0 produces legality/service-boundary assessment. The model never approves the domain. Stage 1+ requires explicit Stage 0 human approval record.

## Stage 6 ↔ 7 Loop

Configurable `maxRuleReviewRounds`. When FIX remains after max rounds: stage → `NEEDS_REVIEW`, run → `WAITING_FOR_HUMAN`. All revisions preserved.

## Bootstrap Scope

Full pipeline documented; bootstrap implements runtime foundation and domain-neutral example stage only.
