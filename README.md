# Domain Forge

System for researching, generating, testing, qualifying, and certifying Hive Domain Packs.

## Constitutional Invariants

```
MODEL PROPOSES. PACK DEFINES. CODE VALIDATES. HIVE CORE EXECUTES. PROFESSIONAL CERTIFIES.
```

## Quick Start

Requires **Node.js >= 22** and **pnpm 9.15** via Corepack:

```bash
corepack enable
corepack pnpm install
corepack pnpm run build
corepack pnpm run test
```

Clean build artifacts (`dist/`, `*.tsbuildinfo` in workspace packages only):

```bash
corepack pnpm run clean
```

On Windows, the repo `.npmrc` uses `node-linker=hoisted` to avoid path-length issues with nested `node_modules`. See `docs/BOOTSTRAP_BASELINE.md`.

Bootstrap completion record: `docs/BOOTSTRAP_BASELINE.md`.

## Documentation

See `docs/ARCHITECTURE.md` and `docs/GUARDRAILS.md`. AI agents: read `AGENTS.md`.

## CLI

```bash
node apps/cli/dist/index.js create-run domain-neutral pack-001 0.1.0
node apps/cli/dist/index.js record-gate <runId> STAGE_0_APPROVAL reviewer-001
node apps/cli/dist/index.js execute-stage <runId>
```
