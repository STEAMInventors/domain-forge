# Domain Forge Architecture

You are creating the production-grade foundation for:

`domain-forge`

Before writing code:

1. Read `docs/ARCHITECTURE.md`.
2. Read the project guardrails.
3. Treat `docs/ARCHITECTURE.md` as the architectural source of truth.
4. Do not broaden scope beyond this bootstrap.

Domain Forge researches, generates, tests, qualifies, and certifies declarative Hive Domain Packs.

The permanent responsibility split is:

```
MODEL PROPOSES.
PACK DEFINES.
CODE VALIDATES.
HIVE CORE EXECUTES.
PROFESSIONAL CERTIFIES.
```

---

## 1. NON-NEGOTIABLE BOUNDARIES

Domain Forge must NOT:

* process real end-user cases;
* contain domain-specific business logic in generic code;
* embed domain rules into Hive Core;
* trust an LLM merely because it returned valid JSON;
* allow models to certify their own work;
* create a private alternative to the shared Domain Pack contract;
* permit arbitrary executable code inside packs;
* silently guess missing facts;
* silently weaken validation;
* silently substitute sources;
* allow fake Hive execution to qualify a pack.

UNKNOWN, NOT_FOUND, NOT_PRESENT, UNDETERMINED, NEEDS_REVIEW, and CapabilityGap are valid fail-closed results.

---

## 2. SHARED PACK CONTRACT

Create:

`packages/pack-contract`

package name:

`@hive/pack-contract`

This is a Hive-shared contract.

Forge consumes it.

Hive Core will consume it.

`@hive/pack-contract` must not depend on Forge.

Create a minimal but real `DomainPackV0`.

It must reserve/support:

* manifest
* scope
* jurisdiction
* dependencies
* authority references
* document types
* vocabulary
* entities
* facts
* extraction contract
* composition configuration
* time models
* identity strategies
* rules
* questions
* weights/priorities
* output specification
* capability requirements
* fixture references
* provenance references

Do not solve every future Domain Pack feature.

Do establish the stable common boundary.

---

## 3. PACK CONTENT VS. LIFECYCLE

Executable pack contents are immutable.

Lifecycle metadata is separate.

A pack version has:

`packContentHash`

Changing:

`DRAFT → PROVISIONAL → CERTIFIED`

must not change pack bytes.

Any executable-content change creates a new PackVersion.

---

## 4. CANONICAL HASHING

Use RFC 8785 JSON Canonicalization Scheme or a clearly isolated versioned implementation equivalent to it.

Hash canonical pack contents only.

Do NOT include:

* lifecycle state
* certification metadata
* reviewer notes
* ForgeRun status
* irrelevant operational timestamps

Provide deterministic tests proving that:

* JSON key order does not change the hash;
* whitespace does not change the hash;
* equivalent YAML and JSON produce the same hash after parsing/canonicalization.

---

## 5. PACK DEPENDENCIES AND OVERLAYS

DomainPackV0 must reserve dependency declarations:

* extends
* overlay
* shared

Dependencies resolve by exact:

* pack ID
* pack version
* packContentHash

Never resolve by `latest`.

Create a deterministic `PackCompositionManifest` and:

`packCompositionHash`

Each layer remains independently versioned, qualified, and certified.

---

## 6. TWO STATE MACHINES

### ForgeRun

```
CREATED
RUNNING
WAITING_FOR_HUMAN
BLOCKED
COMPLETED
FAILED
```

A ForgeRun never becomes CERTIFIED.

A successful run reaches COMPLETED only after a PackVersion reaches PROVISIONAL.

### PackVersion

```
DRAFT
PROVISIONAL
CERTIFIED
SUSPENDED
SUPERSEDED
```

Centralize state transitions.

No arbitrary status mutation.

---

## 7. PIPELINE

Canonical machine-assisted stages:

| Stage | Name |
|-------|------|
| 0 | Legality & Service Boundary |
| 1 | Authority Corpus |
| 2 | Document Landscape |
| 3 | Vocabulary |
| 4 | Pain Points |
| 5 | Structure |
| 6 | Extraction Contract |
| 7 | Rules |
| 8 | Adversarial Review |
| 9 | Synthetic Fixtures |

Then qualification:

* **Layer A** — deterministic rule qualification
* **Layer B** — end-to-end extraction qualification

Then:

`PackVersion → PROVISIONAL`

Then separately:

Human domain certification → `CERTIFIED`

Do not implement stages as unrelated scripts.

Build a generic ForgeStage runtime.

---

## 8. STAGE 0 GATE

Stage 0 produces a frozen risk memo with:

`riskMemoHash`

Stage 1 must not start without a recorded authorized human approval bound to that exact hash.

Enforce this during stage scheduling.

Do not merely check it at the end.

Changing the memo invalidates approval.

---

## 9. REVIEWER AUTHORIZATION

Create:

`ReviewerRoleRegistry`

and generic gate-authorization mechanics.

Generic roles may include:

* FOUNDER_PRODUCT_OWNER
* DOMAIN_EXPERT
* LICENSED_ATTORNEY
* BENEFITS_NAVIGATOR
* PROFESSIONAL_ADVOCATE
* CLINICAL_EXPERT
* EDUCATION_EXPERT

Do not hard-code domain-specific approval policy into generic Forge code.

Gate policy data chooses allowed roles.

---

## 10. GENERIC STAGE MODEL

Implement concepts:

* ForgeRun
* ForgeStageDefinition
* ForgeStageExecution
* StageAttempt
* StageInputProjection
* ForgeArtifact
* ValidationResult
* SourceSnapshot
* EvidenceReference
* CapabilityGap
* PackVersion
* GateApproval
* RuleCertification
* ExtractionQualification

A stage definition includes:

* identity
* version
* dependencies
* input projection
* output schema
* prompt reference
* model policy
* permitted tools
* validators
* retry policy
* loop policy
* budget policy
* gate policy
* artifact outputs

Attempts are immutable.

Retries create new attempts.

---

## 11. STAGE INPUT PROJECTION

Every stage declares exactly which fields it may receive.

Projection is deny-by-default.

Stages may not query arbitrary prior-stage persistence.

Record:

`projectedInputHash`

Example:

Fixture generation may see:

* rule ID
* trigger
* exceptions
* required facts
* structure/document guidance

It must not automatically see:

* rule writer raw response
* hidden reasoning
* unrelated artifacts
* final question text

Add projection tests.

---

## 12. STRUCTURED BOUNDARIES

Every model output follows:

```
model response
→ parse
→ schema validation
→ semantic validation
→ evidence validation
→ reference validation
→ immutable validated artifact
→ projected downstream input
```

No stage consumes raw model output directly.

Nothing passes between stages as conversational context.

---

## 13. FORGE-CONTROLLED RESEARCH

Provider-native authoritative web search/fetch must be disabled.

Create:

* SearchProvider
* SourceRetriever
* SourceSnapshotStore

Interaction:

```
model requests search → Forge searches
model requests URL    → Forge fetches → snapshots → extracts → normalizes → hashes → stores → returns content
```

Search snippets are discovery only.

Only SourceSnapshots may become evidence.

---

## 14. SOURCE TIER RESOLUTION

Create:

* SourceTierResolver
* SourceClassificationRegistry

Models may propose source tier.

Code resolves authoritative tier.

Only resolved tier affects qualification.

The registry is versioned configuration/data.

Do not hard-code domain source knowledge into generic implementation.

---

## 15. SOURCE SNAPSHOT

Support at minimum:

* ID
* original URL
* canonical URL
* title
* retrieval time
* HTTP metadata
* content type
* raw representation
* extracted raw text
* normalized text
* content hash
* extractor version
* normalization version
* resolved source tier
* jurisdiction where relevant
* effective date where established

---

## 16. QUOTE VERIFICATION

Normalization v0 permits ONLY:

1. Unicode NFC.
2. Whitespace collapse.
3. Quote-mark folding.

Do not use:

* fuzzy matching
* paraphrase matching
* semantic similarity
* OCR repair
* automatic de-hyphenation
* disconnected-fragment joining

Failure:

`EVIDENCE_VERIFICATION_FAILED`

Prefer official HTML over equivalent PDF where available.

A future de-hyphenation policy requires ADR + normalization version change.

---

## 17. EVIDENCE

Require evidence for all behavior-affecting content, including:

* rules
* triggers
* exceptions
* deadlines
* fact definitions
* recognition cues
* document relationships
* identity hints
* synonyms
* weights
* priorities
* output ordering
* triage signals
* jurisdiction overrides

Models do not certify evidence.

Code does.

---

## 18. EXTRACTION CONTRACT — CRITICAL

Stage 6 generates a provider-neutral model-facing ExtractionContract.

It must contain domain guidance needed by Hive's frontier extraction model.

Support at minimum:

### Document recognition

* recognition cues
* typical sections
* issuer cues
* distinguishing look-alikes
* relevant dates
* identifiers

### Fact definitions

Each fact includes:

* fact ID
* reader-facing definition
* normal location
* short synthetic positive examples
* negative examples
* what does NOT count
* expected type
* evidence

### Escape hatches

Per fact:

* NOT_PRESENT guidance
* UNDETERMINED guidance
* review-required conditions

### Identity hints

Model-facing hints for proposing matches.

Code remains responsible for accepting/rejecting identity matches.

### Phrasing constraints

Domain-specific factual/linguistic boundaries needed for output rewriting.

Brand voice is not part of the Domain Pack.

---

## 19. EXTRACTION CONTRACT VALIDATION

Every fact used by:

* a rule;
* an output section;
* a triage signal;

must have a defined ExtractionContract entry.

Missing extraction guidance blocks qualification.

Evidence requirements also apply to behavior-affecting extraction guidance.

---

## 20. REGISTRIES

Create centralized versioned registries.

### Primitives

REQUIRE, COMPARE, CONSISTENT, LINK, SERIES, WINDOW

### Grammar

Party, Obligation, Claim, Evidence, Money, Time

### Archetypes

plan-and-progress, ledger, claim-and-evidence, contract-and-performance

### Composition

supersede_amend, ledger_adjust, accumulate, snapshot

### Time

calendar_day, business_day, school_day, court_day, benefit_period

### Identity

external_id, composite_key, reviewed_fuzzy_match

### Outcomes

FIRED, NOT_FIRED, UNDETERMINED

### Output Section Types

FINDINGS_LIST, ENTITY_TABLE, TIMELINE, QUESTION_LIST, DOCUMENT_REQUESTS, CASE_SNAPSHOT

### Source Tiers

1–6

### Question Language

Versioned prohibited/restricted framings.

### Reviewer Roles

Generic human authorization roles.

Do not scatter registry strings through code.

---

## 21. CAPABILITY GAP

Unsupported domain semantics produce:

`CapabilityGap`

An OPEN CapabilityGap blocks PROVISIONAL.

Do not approximate unsupported semantics merely to make a pack pass.

---

## 22. MODEL PROVIDER ABSTRACTION

Create provider-neutral:

* ModelProvider
* ModelRequest
* ModelResponse
* ModelPolicy
* ModelExecutionRecord

Stage implementation uses aliases such as:

* research.high_accuracy
* extraction_contract.deep
* reasoning.deep
* adversarial.independent
* fixture.independent

Actual provider/model mapping belongs in configuration.

---

## 23. MODEL FAMILY INDEPENDENCE

Define independence identity as:

`provider + model family`

Stage 7 writes rules.

Stage 8 adversarially reviews them.

Enforce:

`Stage8 provider/model-family != Stage7 provider/model-family`

Same-family use requires ADR.

Failure:

`INDEPENDENCE_VALIDATION_FAILED`

---

## 24. STAGE 7 ↔ 8 LOOP

Adversarial outcomes:

* PASS
* FIX
* REJECT

FIX returns to Stage 7.

Configure maximum rounds.

After maximum:

* StageExecution → NEEDS_REVIEW
* ForgeRun → WAITING_FOR_HUMAN

Preserve all revisions.

---

## 25. FIXTURE SCHEMA — GOLD FACTS

Stage 9 fixtures must include:

* synthetic documents
* gold facts
* expected rule outcomes
* expected output placement where applicable

Each gold fact supports:

* fact ID
* value
* document ID
* page
* span
* entity association where relevant

Gold facts represent what a careful reader should extract.

---

## 26. FIXTURE COVERAGE

Support:

* FIRED
* NOT_FIRED
* every listed exception
* UNDETERMINED
* missing-document cases

Also allow expected presentation behavior such as:

* must appear in customer top-N
* professional-only
* urgent triage
* document request expected
* timeline placement expected

---

## 27. FIXTURE GENERATION INDEPENDENCE

Stage 9 is a separate model invocation.

It may not receive Stage 7 hidden reasoning/raw output.

For Layer B qualification, fixture documents must be generated by a DIFFERENT MODEL PROVIDER from the target production extraction model.

Record fixture-generation provenance.

If the target extraction provider changes to the fixture author's provider, the fixture set may require regeneration before qualifying that target model.

---

## 28. REALISTIC FIXTURES

Fixture sets must support difficult document characteristics such as:

* tables split across pages
* noisy/scanned text
* look-alike document types
* inconsistent date formats
* missing sections
* duplicate identifiers
* ambiguous references
* handwritten-style annotations where supported

Do not optimize fixture documents for model readability.

---

## 29. HIVE EXECUTOR — TWO MODES

Create:

`HiveExecutor`

with at least:

### FACTS_IN

Input gold facts directly.

Used for Layer A deterministic rule qualification.

### DOCUMENTS_IN

Input synthetic documents through the real extraction path.

Used for Layer B end-to-end qualification.

Also create:

`FakeHiveExecutor`

for development only.

---

## 30. EXECUTOR TRUST

Define:

* TEST
* FAKE
* REAL_HIVE

TEST/FAKE results never count toward DRAFT → PROVISIONAL.

Qualification requires approved REAL_HIVE execution.

Record:

* Hive version
* Hive build ID
* executor version
* trust level
* packContentHash
* packCompositionHash
* fixture ID
* execution mode
* expected result
* actual result
* timestamp
* result hash

---

## 31. LAYER A — RULE QUALIFICATION

Layer A feeds GOLD FACTS directly to REAL_HIVE rule execution.

It tests:

* rule logic
* exceptions
* comparator behavior
* time behavior
* composition
* identity semantics
* UNDETERMINED behavior
* deterministic output routing

Every expected outcome must match.

Failure blocks PROVISIONAL.

---

## 32. LAYER B — EXTRACTION QUALIFICATION

Layer B feeds synthetic documents through the production extraction path.

Compare:

* extracted facts ↔ gold facts
* actual rule outcomes ↔ expected outcomes

Run fixtures multiple times according to qualification policy.

Measure at least:

* recall
* precision
* per-fact-type recall
* per-fact-type precision
* outcome stability
* false fires
* false misses
* UNDETERMINED stability

Thresholds are versioned policy.

Models do not decide whether thresholds passed.

---

## 33. EXTRACTION QUALIFICATION RECORD

Create:

`ExtractionQualification`

bound to:

* packContentHash
* packCompositionHash where applicable
* Hive Core version
* Hive build ID
* extraction provider
* extraction model family
* extraction model version
* extraction policy version
* qualification policy version
* fixture-set hash

States:

* QUALIFIED
* FAILED
* STALE
* NOT_TESTED

---

## 34. EXTRACTION CONTEXT FIT

Create:

`ExtractionContextFitValidator`

It must render the realistic production request:

* extraction system instructions
* pack extraction contract
* extraction schema
* large realistic fixture document set
* output-token reserve

Validate against the configured target model profile.

Include safety margin.

If the request cannot fit:

qualification fails.

Do not rely on silent truncation.

---

## 35. OUTPUT SPECIFICATION

The Domain Pack owns WHAT domain outputs contain.

Hive Core owns HOW they are rendered.

Product owns brand/commercial presentation.

DomainPackV0 should support:

### Professional output

* ordered sections
* rules/facts/entities feeding sections
* tables
* timelines
* document requests
* questions
* triage signals
* export mappings
* professional-only data

### Customer output

* allowed sections
* max findings
* selection rules
* glossary
* domain terminology guidance
* reading-level limits
* banned framings
* professional-only exclusions

---

## 36. OUTPUT SECTION TYPES

Use only registered section types:

FINDINGS_LIST, ENTITY_TABLE, TIMELINE, QUESTION_LIST, DOCUMENT_REQUESTS, CASE_SNAPSHOT

A pack configures these.

It does not provide UI code.

New output semantics require CapabilityGap + ADR + Hive support.

---

## 37. CUSTOMER PROJECTION INVARIANT

Lock this invariant:

**THE CUSTOMER SUMMARY IS A PROJECTION OF THE VALIDATED PROFESSIONAL CASE REPRESENTATION.**

Never perform a second independent customer analysis.

The rewrite model may:

* select
* simplify
* summarize
* rephrase

It may not:

* invent findings
* add substantive claims
* add unsupported advice
* expand meaning

Preserve:

```
NO CHIP, NO CLAIM.
NO VALIDATED CLAIM, NO NARRATIVE STATEMENT.
```

---

## 38. OUTPUT VALIDATION

Add validators ensuring:

* every section uses a registered section type;
* every referenced rule exists;
* every referenced fact exists;
* every referenced entity exists;
* every fireable rule appears in an appropriate professional output;
* professional-only material cannot enter customer output;
* every customer statement traces to a professional finding;
* triage signals reference valid domain semantics;
* weights/order satisfy evidence policy.

---

## 39. OUTPUT FIXTURE TESTS

Fixtures may assert:

* customer top-N placement
* professional-only placement
* urgency classification
* document-request placement
* timeline placement

Layer B should also support repeated semantic checks on generated customer language for:

* meaning preservation
* banned framing avoidance
* no new claims

Do not treat model phrasing as deterministic text equality.

---

## 40. PROVISIONAL GATE

DRAFT → PROVISIONAL only when ALL required conditions pass:

* Stage 0 approval existed before Stage 1;
* all required stages completed;
* schemas pass;
* semantic validators pass;
* quotes verify;
* references resolve;
* source tiers resolve;
* ExtractionContract is complete;
* every rule/output fact has extraction guidance;
* synonyms satisfy evidence policy;
* weights satisfy evidence policy;
* no open CapabilityGap;
* adversarial review resolved;
* fixture coverage passes;
* gold facts validate;
* Layer A REAL_HIVE qualification passes;
* required Layer B ExtractionQualification is QUALIFIED;
* context-fit validation passes;
* output validation passes;
* exact dependency hashes resolve;
* budgets pass;
* pack is frozen;
* canonical packContentHash exists;
* packCompositionHash exists where needed.

Promotion is code-driven.

Not model-driven.

---

## 41. HUMAN RULE CERTIFICATION

Only an authorized domain reviewer may transition:

`PROVISIONAL → CERTIFIED`

Certification covers:

* rules
* exceptions
* questions
* weights
* domain extraction definitions requiring expert judgment
* output specification
* triage semantics
* customer/pro distinction

Record:

* reviewer ID
* reviewer role
* reviewer qualification
* exact packContentHash
* packCompositionHash where relevant
* authority corpus hash
* decision
* notes
* timestamp
* certification policy version

Changing pack content invalidates applicability of prior certification.

---

## 42. EXTRACTION QUALIFICATION IS SEPARATE

Do not force a domain professional to re-certify unchanged rules simply because the production frontier extraction model changes.

Human RuleCertification and automated ExtractionQualification are separate records.

---

## 43. RUNTIME ELIGIBILITY

Hive may execute a pack as fully domain-qualified only when:

* PackVersion == CERTIFIED
* AND all required dependency layers are CERTIFIED
* AND the current runtime combination has ExtractionQualification == QUALIFIED for:
  * pack hash
  * composition hash
  * Hive version
  * extraction model identity
  * extraction policy version

---

## 44. PACK STATUS + QUALIFICATION RESOLUTION

Create architecture abstractions for:

* PackStatusResolver
* ExtractionQualificationResolver

Hive checks both before domain execution.

If certification is absent/suspended OR current extraction qualification is absent/failed/stale:

do not silently execute the domain pack as qualified.

Safe default:

* fall back to generic study where available;
* surface that domain qualification is unavailable.

---

## 45. STALENESS

Pack-level staleness events may include:

* SOURCE_CONTENT_CHANGED
* EFFECTIVE_DATE_BOUNDARY_REACHED
* AUTHORITY_SUPERSEDED
* SOURCE_UNAVAILABLE
* CORPUS_REQUALIFICATION_REQUIRED
* DEPENDENCY_SUSPENDED
* DEPENDENCY_SUPERSEDED

These may suspend the pack.

Extraction-specific events include:

* EXTRACTION_MODEL_CHANGED
* HIVE_EXTRACTION_CHANGED
* EXTRACTION_PROMPT_CHANGED
* EXTRACTION_POLICY_CHANGED

These stale the relevant ExtractionQualification without erasing historical RuleCertification.

---

## 46. BUDGETS

Every ForgeRun must support limits for:

* model invocations
* input tokens
* output tokens
* total tokens
* retries
* adversarial loops
* optional cost budget

Hard-limit violation:

`BUDGET_EXCEEDED`

and automatic progression stops.

---

## 47. PERSISTENCE FOR BOOTSTRAP

Use ONLY:

* InMemory repositories
* JSON-file adapters

Do not add:

* Postgres
* Prisma
* Drizzle
* Supabase
* Redis

Repository interfaces must allow future storage adapters.

---

## 48. APPLICATION BOUNDARY

Bootstrap applications:

```
apps/
  cli/
  worker/
```

Do not create an HTTP API.

---

## 49. PROJECT STRUCTURE

Use approximately:

```
domain-forge/

apps/
  cli/
  worker/

packages/
  pack-contract/
  core/
  orchestration/
  contracts/
  schemas/
  evidence/
  sources/
  models/
  validation/
  stages/
  packs/
  fixtures/
  qualification/
  certification/
  persistence/
  observability/
  testing/

configs/
  models/
  registries/
  budgets/
  qualification/

prompts/
  stage-0/
  stage-1/
  stage-2/
  stage-3/
  stage-4/
  stage-5/
  stage-6/
  stage-7/
  stage-8/
  stage-9/

docs/
  ARCHITECTURE.md
  GUARDRAILS.md
  FORGE_PIPELINE.md
  PACK_CONTRACT.md
  EXTRACTION_CONTRACT.md
  QUALIFICATION.md
  OUTPUT_SPEC.md
  STAGE_PROJECTIONS.md
  VALIDATION_STRATEGY.md
  ERROR_HANDLING.md
  SECURITY.md
  CERTIFICATION.md
  MODEL_POLICY.md
  SOURCE_POLICY.md
  STALENESS.md
  BUDGET_POLICY.md
  TESTING_STRATEGY.md
  ADR/

tests/
  architecture/
  integration/
  conformance/
```

Do not create a Medicaid implementation.

---

## 50. DEPENDENCY DIRECTION

Conceptually:

```
@hive/pack-contract
        ↑
contracts / schemas
        ↑
      core
        ↑
evidence / sources / models / validation / persistence
        ↑
     stages
        ↑
orchestration / qualification
        ↑
   cli / worker
```

`@hive/pack-contract` must not import Forge.

Generic code must not import domain implementations.

---

## 51. PROMPTS ARE DATA

Prompt templates live as versioned files.

Record:

* prompt ID
* prompt version
* prompt file hash
* rendered input hash

Do not embed large prompt strings in stage implementation.

---

## 52. SECURITY

Implement/document:

* environment-only secrets
* secret redaction
* SSRF-safe retrieval
* protocol restrictions
* redirect validation
* size/time limits
* content-type validation
* prompt-injection resistance
* retrieved content treated as untrusted data
* synthetic fixtures only

Provider-native browsing must not bypass Forge source capture.

---

## 53. FIRST IMPLEMENTATION SCOPE

Build the reusable foundation only.

Implement:

1. Workspace configuration.
2. `@hive/pack-contract` with minimal DomainPackV0.
3. Canonical pack hashing.
4. Pack dependency/composition model.
5. ForgeRun state machine.
6. PackVersion lifecycle.
7. Generic ForgeStageDefinition.
8. StageInputProjection.
9. Immutable StageExecution/StageAttempt.
10. Artifact/version/hash model.
11. Prompt registry.
12. ModelProvider interface.
13. FakeModelProvider.
14. SearchProvider interface.
15. SourceRetriever interface.
16. Fake search/retrieval.
17. SourceSnapshot.
18. SourceTierResolver interface.
19. Quote normalization v0.
20. QuoteVerifier.
21. Validator interface.
22. Central registries.
23. ExtractionContractV0 schema.
24. Extraction-contract completeness validator.
25. OutputSpecificationV0 schema.
26. Output-reference validators.
27. Customer-projection validator contract.
28. CapabilityGap.
29. Budget enforcement.
30. Stage model-family independence validator.
31. GoldFact fixture schema.
32. HiveExecutor with FACTS_IN and DOCUMENTS_IN modes.
33. FakeHiveExecutor.
34. ExecutorTrustLevel.
35. RuleQualification record.
36. ExtractionQualification record.
37. ExtractionContextFitValidator interface.
38. ProvisionalReadinessValidator.
39. ReviewerRoleRegistry.
40. GateApproval.
41. RuleCertification record.
42. PackStatusResolver interface.
43. ExtractionQualificationResolver interface.
44. StalenessEvaluator hooks.
45. InMemory persistence.
46. JSON-file persistence.
47. CLI.
48. Worker/orchestrator foundation.
49. Tests.
50. One tiny DOMAIN-NEUTRAL example proving orchestration works.

Do not attempt real production web research yet.

Do not attempt a real Medicaid pack yet.

Do not invent an IEP pack.

---

## 54. IMPORTANT BOOTSTRAP QUALIFICATION LIMITATION

Because this bootstrap uses FakeHiveExecutor:

NO pack produced during this bootstrap may reach genuine PROVISIONAL status based on fake execution.

Tests may demonstrate:

"would otherwise qualify except REAL_HIVE evidence is missing."

The system must prove that FakeHiveExecutor is rejected by ProvisionalReadinessValidator.

---

## 55. REQUIRED TESTS

At minimum:

* package dependency tests
* DomainPackV0 contract tests
* canonical-hash tests
* composition-hash tests
* run-state tests
* pack-state tests
* Stage 0 scheduling gate tests
* stage projection tests
* model-family independence tests
* schema tests
* quote-normalization tests
* quote-verification tests
* source-tier resolver tests
* extraction-contract completeness tests
* output-reference tests
* customer-projection tests
* capability-gap tests
* budget tests
* fixture gold-fact tests
* FakeHive qualification rejection test
* HiveExecutor mode contract tests
* ExtractionQualification identity tests
* context-fit validator contract tests
* certification/hash-binding tests
* runtime eligibility tests
* staleness tests

No live LLM calls in ordinary unit tests.

---

## 56. IEP CONFORMANCE HARNESS

Create the ability to validate an existing Domain Pack against `@hive/pack-contract`.

If an actual canonical qualified IEP pack is later supplied, it can be placed under conformance fixtures and marked:

`hand-authored-pre-forge`

Do not invent one.

Do not copy IEP rules into generic code.

---

## 57. TECHNOLOGY BASELINE

Use:

* Node.js 22+
* TypeScript
* strict TypeScript
* pnpm workspaces
* Zod
* Vitest
* ESLint
* Prettier

Do NOT introduce:

* Postgres
* ORM
* Redis
* Kafka
* Kubernetes
* vector DB
* workflow engine
* HTTP API
* microservices

---

## 58. QUALITY BAR

Before finishing:

* TypeScript build passes.
* lint passes.
* tests pass.
* run state and pack state are separate.
* pack hashing is deterministic.
* overlay/dependency hashes are explicit.
* certification binds to exact pack hash.
* Stage 0 blocks Stage 1 without approval.
* stage projections are enforced.
* provider-native authoritative browsing is absent.
* source tiers are code-resolved.
* quote normalization follows v0 exactly.
* ExtractionContract exists.
* rule facts require extraction definitions.
* fixtures support gold facts.
* FakeHive cannot qualify a pack.
* RuleQualification and ExtractionQualification are separate.
* extraction qualification binds to runtime/model identity.
* output specification is declarative.
* customer output cannot create new findings.
* registries reject unknown semantics.
* open CapabilityGap blocks qualification.
* no domain-specific logic exists in generic code.
* no database or HTTP API was added.

---

## 59. EXECUTION ORDER

1. Inspect repository.
2. Read existing architecture and guardrails.
3. Update architecture docs if needed to match this prompt.
4. Establish workspace.
5. Implement `@hive/pack-contract`.
6. Implement hashing/composition.
7. Implement state machines.
8. Implement stage/runtime contracts.
9. Implement evidence/source contracts.
10. Implement registries.
11. Implement ExtractionContract.
12. Implement OutputSpecification.
13. Implement fixture/gold-fact contracts.
14. Implement qualification records/interfaces.
15. Implement certification/runtime eligibility.
16. Implement persistence adapters.
17. Implement CLI/worker skeleton.
18. Add tests.
19. Run narrow tests while developing.
20. Run full build/lint/tests.
21. Fix all failures.
22. Review implementation against ARCHITECTURE.md and GUARDRAILS.md.

Do not ask implementation questions unless genuinely impossible to proceed.

Make the smallest architecture-consistent decisions.

Do not broaden scope.

---

## 60. FINAL RESPONSE FORMAT

Return only:

### Files created/changed

Grouped briefly.

### Architecture implemented

Concise.

### Verification

Exact build/lint/test commands and results.

### Guardrail review

Violations discovered and corrected.

### Decisions requiring review

Only unresolved architecture decisions.
