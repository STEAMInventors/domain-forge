# Domain Forge Bootstrap Baseline

**Status:** DOMAIN FORGE BOOTSTRAP BASELINE — COMPLETE  
**Section 59:** Steps 1–21 complete  
**Baseline freeze date:** 2026-09-25  

This document records the engineering baseline after bootstrap. Architecture and Core changes after this point require a documented defect or an approved architecture change (ADR). New domain behavior belongs in Domain Packs, not generic Forge/Hive code.

## Runtime and tooling

| Item | Policy |
|------|--------|
| Node.js | **>= 22.0.0** (see `package.json` `engines` and ARCHITECTURE §57) |
| pnpm | **9.15.0** via Corepack (`packageManager` field) and root `devDependencies` (for recursive root scripts) |
| Install | `corepack enable` then `corepack pnpm install --frozen-lockfile` |

**Verification runtime note:** Final Step-21 verification in this environment ran on Node **20.18.0** (informative only; not engine-compliant). Re-run the canonical verification chain on Node **>= 22** before production Domain Pack work.

## Windows development

Repository `.npmrc` sets `node-linker=hoisted` so pnpm workspace installs stay within typical Windows path-length limits while preserving lockfile and workspace semantics. Do not remove without validating nested dependency layouts on Windows.

## Canonical verification commands

Run from repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run clean
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm run build

`typecheck` emits workspace `dist/` declarations (via sorted recursive build) before `--noEmit` checks so cold verification after `clean` succeeds. A follow-up `build` is incremental.
corepack pnpm run test
corepack pnpm run test:architecture
corepack pnpm run test:adversarial
```

CLI smoke (after build):

```bash
node apps/cli/dist/index.js help
```

Worker smoke (importable API, no auto-poll on import):

```bash
node -e "import('./apps/worker/dist/index.js').then(m => console.log(typeof m.runWorkerLoop))"
```

Worker process (polling loop):

```bash
node apps/worker/dist/main.js
```

## Qualification → certification → runtime eligibility

1. **Qualify** — binds exact `packContentHash` + fixture corpus; produces `QualificationRecord` (not certification).
2. **Certify** — human-governed; requires fresh, matching qualification evidence; atomic persistence of `CertificationRecord` and `CERTIFIED` lifecycle transition.
3. **Runtime eligibility** — requires valid `CertificationRecord`, capability/dependency checks, and non-stale bindings; `CERTIFIED` alone is insufficient.

CLI commands: `qualify`, `certify`, `runtime-eligibility` (see CLI `--help`).

## Workspace

- **Packages:** 17 under `packages/` (`@hive/pack-contract` + 16 `@domain-forge/*`)
- **Apps:** `apps/cli`, `apps/worker`

## Architecture invariants (bootstrap)

- Domain Packs are declarative; generic Core/Forge remains domain-neutral.
- Model proposes; Pack defines; code validates; professional certifies.
- Proposed ≠ accepted for evidence, extraction, and output artifacts.
- No chip → no claim; no validated claim → no narrative statement.
- Qualification cannot certify; certification binds exact pack hash and qualification evidence.
- Runtime eligibility is evaluated; not a mutable persistence flag.
- CLI/worker orchestrate only; no bypass of gates.

## Test baseline (Step 21)

Recorded after final clean verification in this step (counts may increase with regression tests; must not decrease without explanation):

| Suite | Tests | Files |
|-------|------:|------:|
| Full (`corepack pnpm run test`) | 638 | 73 |
| Architecture (`test:architecture`) | 46 | 11 |
| Adversarial (`test:adversarial`) | 225 | 20 |

## Accepted post-bootstrap debt

| Item | Classification |
|------|----------------|
| Source-tier fallback semantics | ACCEPTED POST-BOOTSTRAP |
| Nested `structured_object` richness | ACCEPTED POST-BOOTSTRAP |
| Customer projection validator | ACCEPTED POST-BOOTSTRAP |
| Defensive `ValidatedClaim.rejected` | ACCEPTED POST-BOOTSTRAP |
| Production extraction/output stage wiring | ACCEPTED POST-BOOTSTRAP |
| RUNNING crash recovery engine | ACCEPTED POST-BOOTSTRAP |
| Persisted fixture execution loading | ACCEPTED POST-BOOTSTRAP |
| Public test-helper / `FakeHiveExecutor` exports | ACCEPTED POST-BOOTSTRAP |
| Package-local `test` scripts | ACCEPTED POST-BOOTSTRAP |
| Node 22 execution in CI/dev (environment) | ACCEPTED POST-BOOTSTRAP (validate on Node >= 22) |

## Ready for Domain Pack development

The bootstrap baseline is **frozen** for Section 59. Begin Domain Pack authoring against `@hive/pack-contract`, qualification profiles, and certification profiles using the established CLI/worker flows.
