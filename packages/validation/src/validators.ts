import {
  DomainPackV0Schema,
  computePackContentHash,
  type DomainPackV0,
} from '@hive/pack-contract';
import {
  PrimitiveRegistry,
  ArchetypeRegistry,
  CompositionRegistry,
  TimeModelRegistry,
  IdentityStrategyRegistry,
  CoreGrammarRegistry,
  SourceTierRegistry,
  isBannedQuestionLanguage,
  hasOpenCapabilityGaps,
  type CapabilityGap,
} from '@domain-forge/core';
import type {
  ValidationResult,
  ValidatorContext,
  ForgeStageDefinition,
  SyntheticFixture,
  FixtureExecutionRecord,
} from '@domain-forge/contracts';
import {
  acceptProposedEvidenceReferences,
  verifyQuote,
  type EvidenceAcceptanceContext,
} from '@domain-forge/evidence';
import { createPackRegistries } from '@domain-forge/core';
import {
  validateExtractionContractCompleteness,
  validateExtractionContractReferences,
} from './extraction-contract-validation.js';
import {
  validateOutputSpecificationCompleteness,
  validateOutputSpecificationReferences,
} from './output-specification-validation.js';
import type { ProposedEvidenceReference, SourceRecord } from '@domain-forge/contracts';
import { BaseValidator, makeResult } from './base.js';
import { projectStageInput } from './projection.js';

export class SchemaValidator extends BaseValidator<unknown> {
  readonly id = 'schema';
  readonly version = '1.0.0';

  validate(input: unknown): ValidationResult {
    const result = DomainPackV0Schema.safeParse(input);
    if (result.success) return this.pass();
    return this.fail(
      result.error.issues.map((i) => ({
        code: 'SCHEMA_VALIDATION_ERROR',
        message: i.message,
        path: i.path.join('.'),
      })),
    );
  }
}

export class PackHashValidator extends BaseValidator<{ pack: DomainPackV0; expectedHash: string }> {
  readonly id = 'pack-hash';
  readonly version = '1.0.0';

  validate(input: { pack: DomainPackV0; expectedHash: string }): ValidationResult {
    const actual = computePackContentHash(input.pack);
    if (actual !== input.expectedHash) {
      return this.fail([
        {
          code: 'INVARIANT_VIOLATION',
          message: `Pack hash mismatch: expected ${input.expectedHash}, got ${actual}`,
        },
      ]);
    }
    return this.pass();
  }
}

export class PrimitiveValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'primitive';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    for (const rule of input.rules) {
      if (!PrimitiveRegistry.has(rule.primitive)) {
        errors.push({
          code: 'BLOCKED_CAPABILITY',
          message: `Unknown primitive: ${rule.primitive}`,
          path: `rules.${rule.id}.primitive`,
        });
      }
    }
    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class EnumRegistryValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'enum-registry';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    try {
      if (input.composition.strategy !== undefined) {
        CompositionRegistry.assert(input.composition.strategy);
      }
      if (input.composition.archetype !== undefined) {
        ArchetypeRegistry.assert(input.composition.archetype);
      }
    } catch (e) {
      errors.push({ code: 'SEMANTIC_VALIDATION_ERROR', message: String(e) });
    }
    for (const tm of input.timeModels) {
      if (!TimeModelRegistry.has(tm.model)) {
        errors.push({ code: 'BLOCKED_CAPABILITY', message: `Unknown time model: ${tm.model}` });
      }
    }
    for (const is of input.identityStrategies) {
      if (!IdentityStrategyRegistry.has(is.strategy)) {
        errors.push({ code: 'BLOCKED_CAPABILITY', message: `Unknown identity strategy: ${is.strategy}` });
      }
    }
    for (const entity of input.entities) {
      if (!CoreGrammarRegistry.has(entity.grammarType)) {
        errors.push({ code: 'BLOCKED_CAPABILITY', message: `Unknown grammar type: ${entity.grammarType}` });
      }
    }
    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class EntityReferenceValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'entity-reference';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const entityIds = new Set(input.entities.map((e) => e.id));
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    for (const fact of input.facts) {
      if (!entityIds.has(fact.entityId)) {
        errors.push({ code: 'SEMANTIC_VALIDATION_ERROR', message: `Fact ${fact.id} references unknown entity ${fact.entityId}` });
      }
    }
    for (const rule of input.rules) {
      for (const eid of rule.entityIds) {
        if (!entityIds.has(eid)) {
          errors.push({ code: 'SEMANTIC_VALIDATION_ERROR', message: `Rule ${rule.id} references unknown entity ${eid}` });
        }
      }
    }
    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class ExtractionContractReferenceValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'extraction-contract-reference';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const registries = createPackRegistries(input);
    const result = validateExtractionContractReferences(input, registries);
    if (!result.valid) {
      return this.fail(
        result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          ...(e.path !== undefined ? { path: e.path } : {}),
        })),
      );
    }
    return this.pass();
  }
}

export class OutputSpecificationReferenceValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'output-specification-reference';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const registries = createPackRegistries(input);
    const result = validateOutputSpecificationReferences(input, registries);
    if (!result.valid) {
      return this.fail(
        result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          ...(e.path !== undefined ? { path: e.path } : {}),
        })),
      );
    }
    return this.pass();
  }
}

export class OutputSpecificationCompletenessValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'output-specification-completeness';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const result = validateOutputSpecificationCompleteness(input);
    if (!result.valid) {
      return this.fail(
        result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          ...(e.path !== undefined ? { path: e.path } : {}),
        })),
      );
    }
    return this.pass();
  }
}

export class ExtractionContractCompletenessValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'extraction-contract-completeness';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const result = validateExtractionContractCompleteness(input);
    if (!result.valid) {
      return this.fail(
        result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          ...(e.path !== undefined ? { path: e.path } : {}),
        })),
      );
    }
    return this.pass();
  }
}

export class FactReferenceValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'fact-reference';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const factIds = new Set(input.facts.map((f) => f.id));
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    for (const rule of input.rules) {
      for (const fid of rule.factIds) {
        if (!factIds.has(fid)) {
          errors.push({ code: 'SEMANTIC_VALIDATION_ERROR', message: `Rule ${rule.id} references unknown fact ${fid}` });
        }
      }
    }
    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class QuestionLanguageValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'question-language';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    for (const q of input.questions) {
      if (isBannedQuestionLanguage(q.text)) {
        errors.push({ code: 'SEMANTIC_VALIDATION_ERROR', message: `Question ${q.id} contains banned language` });
      }
    }
    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class QuoteVerifierValidator extends BaseValidator<{
  quote: string;
  sourceNormalizedText: string;
}> {
  readonly id = 'quote-verifier';
  readonly version = '1.0.0';

  validate(input: { quote: string; sourceNormalizedText: string }): ValidationResult {
    const result = verifyQuote(input);
    if (!result.verified) {
      return this.fail([{ code: 'EVIDENCE_VERIFICATION_FAILED', message: result.error ?? 'Quote not verified' }]);
    }
    return this.pass();
  }
}

export class EvidenceReferenceValidator extends BaseValidator<{
  proposals: readonly ProposedEvidenceReference[];
  sources: readonly SourceRecord[];
  getSourceNormalizedText?: (source: SourceRecord) => string | undefined;
}> {
  readonly id = 'evidence-reference';
  readonly version = '1.0.0';

  validate(input: {
    proposals: readonly ProposedEvidenceReference[];
    sources: readonly SourceRecord[];
    getSourceNormalizedText?: (source: SourceRecord) => string | undefined;
  }): ValidationResult {
    const sourceMap = new Map(input.sources.map((s) => [s.identity.sourceId, s]));
    const context: EvidenceAcceptanceContext = {
      resolveSource: (sourceId) => sourceMap.get(sourceId as never),
      ...(input.getSourceNormalizedText !== undefined
        ? { getSourceNormalizedText: input.getSourceNormalizedText }
        : {}),
    };

    const { result } = acceptProposedEvidenceReferences(input.proposals, context);
    if (!result.valid) {
      return this.fail(
        result.errors.map((e) => ({
          code: e.code,
          message: e.message,
          ...(e.path !== undefined ? { path: e.path } : {}),
        })),
      );
    }
    return this.pass();
  }
}

export class ReferenceIntegrityValidator extends BaseValidator<DomainPackV0> {
  readonly id = 'reference-integrity';
  readonly version = '1.0.0';

  validate(input: DomainPackV0): ValidationResult {
    const authIds = new Set(input.authorityReferences.map((a) => a.id));
    const errors: Array<{ code: string; message: string; path?: string }> = [];
    for (const rule of input.rules) {
      for (const refId of rule.authorityRefIds) {
        if (!authIds.has(refId)) {
          errors.push({ code: 'SEMANTIC_VALIDATION_ERROR', message: `Rule ${rule.id} references unknown authority ${refId}` });
        }
      }
    }
    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class SourceTierValidator extends BaseValidator<{ tier: string }> {
  readonly id = 'source-tier';
  readonly version = '1.0.0';

  validate(input: { tier: string }): ValidationResult {
    if (!SourceTierRegistry.has(input.tier)) {
      return this.fail([{ code: 'SEMANTIC_VALIDATION_ERROR', message: `Invalid source tier: ${input.tier}` }]);
    }
    return this.pass();
  }
}

export class CorpusHashValidator extends BaseValidator<{ packCorpusHash: string; expectedCorpusHash: string }> {
  readonly id = 'corpus-hash';
  readonly version = '1.0.0';

  validate(input: { packCorpusHash: string; expectedCorpusHash: string }): ValidationResult {
    if (input.packCorpusHash !== input.expectedCorpusHash) {
      return this.fail([{ code: 'INVARIANT_VIOLATION', message: 'Corpus hash mismatch' }]);
    }
    return this.pass();
  }
}

export class StageProjectionValidator extends BaseValidator<{
  definition: ForgeStageDefinition;
  artifacts: Record<string, unknown>;
}> {
  readonly id = 'stage-projection';
  readonly version = '1.0.0';

  validate(input: { definition: ForgeStageDefinition; artifacts: Record<string, unknown> }): ValidationResult {
    try {
      projectStageInput(input.definition, input.artifacts);
      return this.pass();
    } catch (e) {
      return this.fail([{ code: 'STAGE_PROJECTION_ERROR', message: String(e) }]);
    }
  }
}

export class StageIndependenceValidator extends BaseValidator<{
  stage6ModelIdentity: string;
  stage7ModelIdentity: string;
}> {
  readonly id = 'stage-independence';
  readonly version = '1.0.0';

  validate(input: { stage6ModelIdentity: string; stage7ModelIdentity: string }): ValidationResult {
    if (input.stage6ModelIdentity === input.stage7ModelIdentity) {
      return this.fail([
        {
          code: 'INDEPENDENCE_VALIDATION_FAILED',
          message: 'Stage 7 model identity must differ from Stage 6',
        },
      ]);
    }
    return this.pass();
  }
}

export class BudgetValidator extends BaseValidator<{ withinBudget: boolean; reason?: string }> {
  readonly id = 'budget';
  readonly version = '1.0.0';

  validate(input: { withinBudget: boolean; reason?: string }): ValidationResult {
    if (!input.withinBudget) {
      return this.fail([{ code: 'BUDGET_EXCEEDED', message: input.reason ?? 'Budget exceeded' }]);
    }
    return this.pass();
  }
}

export class CapabilityGapValidator extends BaseValidator<{ gaps: CapabilityGap[] }> {
  readonly id = 'capability-gap';
  readonly version = '1.0.0';

  validate(input: { gaps: CapabilityGap[] }): ValidationResult {
    if (hasOpenCapabilityGaps(input.gaps)) {
      return this.fail([{ code: 'BLOCKED_CAPABILITY', message: 'Open capability gaps remain' }]);
    }
    return this.pass();
  }
}

export class FixtureCoverageValidator extends BaseValidator<{
  rules: DomainPackV0['rules'];
  fixtures: SyntheticFixture[];
  minCoverageRatio: number;
}> {
  readonly id = 'fixture-coverage';
  readonly version = '1.0.0';

  validate(input: {
    rules: DomainPackV0['rules'];
    fixtures: SyntheticFixture[];
    minCoverageRatio: number;
  }): ValidationResult {
    if (input.rules.length === 0) return this.pass();
    const covered = new Set(input.fixtures.map((f) => f.ruleId));
    const ratio = input.rules.filter((r) => covered.has(r.id)).length / input.rules.length;
    if (ratio < input.minCoverageRatio) {
      return this.fail([
        { code: 'FAILED_VALIDATION', message: `Fixture coverage ${ratio} below threshold ${input.minCoverageRatio}` },
      ]);
    }
    return this.pass();
  }
}

export class FixtureExecutionValidator extends BaseValidator<{ records: FixtureExecutionRecord[] }> {
  readonly id = 'fixture-execution';
  readonly version = '1.0.0';

  validate(input: { records: FixtureExecutionRecord[] }): ValidationResult {
    const failures = input.records.filter((r) => !r.matched);
    if (failures.length > 0) {
      return this.fail(
        failures.map((f) => ({
          code: 'HIVE_EXECUTION_ERROR',
          message: `Fixture ${f.fixtureId}: expected ${f.expectedOutcome}, got ${f.actualOutcome}`,
        })),
      );
    }
    return this.pass();
  }
}

export interface ProvisionalReadinessInput {
  stage0Approved: boolean;
  allStagesCompleted: boolean;
  schemaValid: boolean;
  semanticValid: boolean;
  evidenceValid: boolean;
  quotesVerified: boolean;
  referencesResolved: boolean;
  primitivesValid: boolean;
  structuresValid: boolean;
  noOpenGaps: boolean;
  adversarialClear: boolean;
  fixturesExist: boolean;
  fixturesMatch: boolean;
  fixtureCoverageMet: boolean;
  budgetOk: boolean;
  noBlockingHumanReview: boolean;
  packContentHashFrozen: boolean;
}

export class ProvisionalReadinessValidator extends BaseValidator<ProvisionalReadinessInput> {
  readonly id = 'provisional-readiness';
  readonly version = '1.0.0';

  validate(input: ProvisionalReadinessInput, _context?: ValidatorContext): ValidationResult {
    const checks: [keyof ProvisionalReadinessInput, string][] = [
      ['stage0Approved', 'Stage 0 human approval missing'],
      ['allStagesCompleted', 'Not all required stages completed'],
      ['schemaValid', 'Schema validation failed'],
      ['semanticValid', 'Semantic validation failed'],
      ['evidenceValid', 'Evidence validation failed'],
      ['quotesVerified', 'Quote verification failed'],
      ['referencesResolved', 'Reference resolution failed'],
      ['primitivesValid', 'Primitive validation failed'],
      ['structuresValid', 'Structure validation failed'],
      ['noOpenGaps', 'Open capability gaps exist'],
      ['adversarialClear', 'Adversarial review has unresolved FIX/REJECT items'],
      ['fixturesExist', 'Required fixtures missing'],
      ['fixturesMatch', 'Fixture execution mismatch'],
      ['fixtureCoverageMet', 'Fixture coverage threshold not met'],
      ['budgetOk', 'Budget violation exists'],
      ['noBlockingHumanReview', 'Blocking human review item remains'],
      ['packContentHashFrozen', 'Pack content hash not frozen'],
    ];

    const errors = checks
      .filter(([key]) => !input[key])
      .map(([, msg]) => ({ code: 'FAILED_VALIDATION' as const, message: msg }));

    return errors.length ? this.fail(errors) : this.pass();
  }
}

export class CertificationValidator extends BaseValidator<{
  packContentHash: string;
  certificationHash: string;
  decision: string;
}> {
  readonly id = 'certification';
  readonly version = '1.0.0';

  validate(input: {
    packContentHash: string;
    certificationHash: string;
    decision: string;
  }): ValidationResult {
    if (input.decision !== 'CERTIFIED') {
      return this.fail([{ code: 'CERTIFICATION_ERROR', message: 'Decision is not CERTIFIED' }]);
    }
    if (input.packContentHash !== input.certificationHash) {
      return this.fail([
        {
          code: 'CERTIFICATION_ERROR',
          message: 'Certification hash does not match pack content hash',
        },
      ]);
    }
    return this.pass();
  }
}

export function validatePack(input: DomainPackV0): ValidationResult[] {
  const validators = [
    new SchemaValidator(),
    new PrimitiveValidator(),
    new EnumRegistryValidator(),
    new EntityReferenceValidator(),
    new FactReferenceValidator(),
    new ExtractionContractReferenceValidator(),
    new OutputSpecificationReferenceValidator(),
    new ReferenceIntegrityValidator(),
    new QuestionLanguageValidator(),
  ];
  return validators.map((v) => v.validate(input));
}

export function allPassed(results: ValidationResult[]): boolean {
  return results.every((r) => r.passed);
}

export { makeResult };
