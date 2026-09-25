# Domain Forge

System for researching, generating, testing, qualifying, and certifying Hive Domain Packs.

## Constitutional Invariants

```
MODEL PROPOSES. PACK DEFINES. CODE VALIDATES. HIVE CORE EXECUTES. PROFESSIONAL CERTIFIES.
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Documentation

See `docs/ARCHITECTURE.md` and `docs/GUARDRAILS.md`. AI agents: read `AGENTS.md`.

## CLI

```bash
node apps/cli/dist/index.js create-run domain-neutral pack-001 0.1.0
node apps/cli/dist/index.js record-gate <runId> STAGE_0_APPROVAL reviewer-001
node apps/cli/dist/index.js execute-stage <runId>
```
