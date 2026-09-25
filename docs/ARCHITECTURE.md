# Domain Forge Architecture

## Constitutional Invariants

```
MODEL PROPOSES.
PACK DEFINES.
CODE VALIDATES.
HIVE CORE EXECUTES.
PROFESSIONAL CERTIFIES.
```

Domain Forge researches, generates, tests, qualifies, and certifies Hive Domain Packs. It does **not** process end-user cases, contain domain-specific logic, or replace Hive Core.

## Dependency Direction

```
@hive/pack-contract
        ↑
Forge contracts / schemas
        ↑
      core
        ↑
evidence / sources / models / validation / persistence
        ↑
     stages
        ↑
 orchestration
        ↑
   cli / worker
```

`@hive/pack-contract` is a Hive-shared contract. Forge and Hive Core both import it. It never imports Forge.

## Two State Machines

### ForgeRun (orchestration lifecycle)

`CREATED → RUNNING → WAITING_FOR_HUMAN → RUNNING`

Terminal: `COMPLETED`, `FAILED`. Resumable: `BLOCKED`, `WAITING_FOR_HUMAN`.

A ForgeRun finishes; it never becomes CERTIFIED.

### PackVersion (pack lifecycle)

`DRAFT → PROVISIONAL → CERTIFIED`

Additional: `SUSPENDED`, `SUPERSEDED`. CERTIFIED cannot revert to DRAFT.

Pack lifecycle state is **outside** immutable pack bytes. Changing state does not mutate reviewed content.

## Immutable Pack Content

Each pack version has a deterministic `packContentHash`. Certification binds to the exact hash reviewed. Any content change produces a new version and hash.

## Pipeline

Stage 0 — Legality & Service Boundary (hard human gate)
Stage 1 — Authority Corpus
Stage 2 — Document Landscape
Stage 3 — Vocabulary
Stage 4 — Pain Points
Stage 5 — Structure
Stage 6 — Rules
Stage 7 — Adversarial Review
Stage 8 — Synthetic Fixtures
Stage 9 — Human Certification

Bootstrap implements generic stage runtime plus one domain-neutral example stage.

## Stage Input Projection

Deny-by-default. Each stage declares allowed artifact types and fields. The orchestrator constructs projected input and records `projectedInputHash`. Stages may not query previous persistence directly.

## Forge-Controlled Research

Provider-native web search/retrieval is disabled. Model requests search → Forge SearchProvider executes. Model requests URL → Forge SourceRetriever fetches, snapshots, hashes. Search snippets are discovery aids only; evidence requires stored SourceSnapshot.

## Provisional Gate

Code-driven transition DRAFT → PROVISIONAL when all readiness checks pass (see `ProvisionalReadinessValidator`). The model does not decide provisional status.

## Certification Gate

Only explicit human action moves PROVISIONAL → CERTIFIED. Certification records bind to exact `packContentHash`.

## Persistence (Bootstrap)

In-memory repositories plus JSON-file adapters. No database in this pass. All persistence behind repository interfaces.

## Applications

- **CLI**: create run, inspect, execute stage, resume, record gate, certify, provenance
- **Worker**: hosts orchestration polling/resume loop

No HTTP API in this pass.
