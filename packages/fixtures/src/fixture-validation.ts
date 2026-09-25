import type { PackRegistries } from '@domain-forge/core';
import type {
  FixtureCorpus,
  FixtureDefinition,
  FixtureValidationContext,
  FixtureValidationError,
  FixtureValidationResult,
  GoldFact,
  ProposedFixtureBundle,
} from '@domain-forge/contracts';
import type { SourceId } from '@domain-forge/core';
import { computeFixtureCorpusHash } from './corpus-hash.js';
import {
  FixtureCorpusSchema,
  FixtureDefinitionSchema,
  GoldFactSchema,
  ProposedFixtureBundleSchema,
} from './schemas.js';

function fail(errors: FixtureValidationError[]): FixtureValidationResult {
  return { valid: false, errors };
}

function pass(): FixtureValidationResult {
  return { valid: true, errors: [] };
}

function err(
  code: FixtureValidationError['code'],
  message: string,
  path?: string,
  context?: Readonly<Record<string, unknown>>,
): FixtureValidationError {
  return {
    code,
    message,
    ...(path !== undefined ? { path } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}

function validateGoldFactReferences(
  gold: GoldFact,
  registries: PackRegistries,
  path: string,
  errors: FixtureValidationError[],
): void {
  if (!registries.extractionContracts.has(gold.extractionContractId)) {
    errors.push(
      err(
        'GOLD_REFERENCE_UNRESOLVED',
        `Unknown extractionContractId ${gold.extractionContractId}`,
        `${path}.extractionContractId`,
      ),
    );
  }
  if (!registries.facts.has(gold.factId)) {
    errors.push(err('GOLD_REFERENCE_UNRESOLVED', `Unknown factId ${gold.factId}`, `${path}.factId`));
  }
  if (gold.entityId !== undefined && !registries.entities.has(gold.entityId)) {
    errors.push(
      err('GOLD_REFERENCE_UNRESOLVED', `Unknown entityId ${gold.entityId}`, `${path}.entityId`),
    );
  }
  if (gold.documentTypeId !== undefined && !registries.documentTypes.has(gold.documentTypeId)) {
    errors.push(
      err(
        'GOLD_REFERENCE_UNRESOLVED',
        `Unknown documentTypeId ${gold.documentTypeId}`,
        `${path}.documentTypeId`,
      ),
    );
  }

  const contract = registries.extractionContracts.has(gold.extractionContractId)
    ? registries.extractionContracts.resolve(gold.extractionContractId)
    : undefined;
  if (contract !== undefined && contract.factId !== gold.factId) {
    errors.push(
      err(
        'GOLD_CONTRADICTORY_EXPECTATION',
        `Gold fact ${gold.factId} does not match contract factId ${contract.factId}`,
        `${path}.factId`,
      ),
    );
  }

  if (gold.expectation.kind === 'present') {
    for (const [index, outcome] of gold.expectation.outcomes.entries()) {
      if (outcome.kind === 'value' && outcome.value.kind === 'boolean' && contract !== undefined) {
        if (contract.expectedType !== 'boolean') {
          errors.push(
            err(
              'GOLD_INVALID_VALUE',
              'Boolean gold value requires boolean extraction contract',
              `${path}.expectation.outcomes[${index}]`,
            ),
          );
        }
      }
      if (outcome.kind === 'value' && outcome.value.kind === 'number' && contract !== undefined) {
        if (contract.expectedType !== 'number' && contract.expectedType !== 'money') {
          errors.push(
            err(
              'GOLD_INVALID_VALUE',
              'Numeric gold value incompatible with contract expectedType',
              `${path}.expectation.outcomes[${index}]`,
            ),
          );
        }
        if (outcome.value.value === 0 && contract.expectedType === 'number') {
          // zero is valid — distinct from missing
        }
      }
    }
  }

  for (const [evIndex, evidence] of (gold.expectedEvidence ?? []).entries()) {
    if (!/^[a-f0-9]{64}$/.test(evidence.sourceContentFingerprint)) {
      errors.push(
        err(
          'GOLD_INVALID_EVIDENCE',
          'Expected evidence fingerprint must be a 64-char hex digest',
          `${path}.expectedEvidence[${evIndex}].sourceContentFingerprint`,
        ),
      );
    }
  }
}

function validateForbiddenExpectations(
  fixture: FixtureDefinition,
  registries: PackRegistries,
  path: string,
  errors: FixtureValidationError[],
): void {
  for (const [index, forbidden] of fixture.forbiddenExpectations.entries()) {
    switch (forbidden.kind) {
      case 'fact':
        if (!registries.facts.has(forbidden.factId)) {
          errors.push(
            err(
              'FORBIDDEN_EXPECTATION_MALFORMED',
              `Unknown forbidden factId ${forbidden.factId}`,
              `${path}.forbiddenExpectations[${index}]`,
            ),
          );
        }
        if (
          forbidden.contractId !== undefined &&
          !registries.extractionContracts.has(forbidden.contractId)
        ) {
          errors.push(
            err(
              'FORBIDDEN_EXPECTATION_MALFORMED',
              `Unknown forbidden contractId ${forbidden.contractId}`,
              `${path}.forbiddenExpectations[${index}]`,
            ),
          );
        }
        break;
      case 'claim':
        break;
      case 'rule_fired':
        if (!registries.rules.has(forbidden.ruleId)) {
          errors.push(
            err(
              'FORBIDDEN_EXPECTATION_MALFORMED',
              `Unknown forbidden ruleId ${forbidden.ruleId}`,
              `${path}.forbiddenExpectations[${index}]`,
            ),
          );
        }
        break;
      case 'output_section':
        if (!registries.outputSpecifications.has(forbidden.specificationId)) {
          errors.push(
            err(
              'FORBIDDEN_EXPECTATION_MALFORMED',
              `Unknown output specification ${forbidden.specificationId}`,
              `${path}.forbiddenExpectations[${index}]`,
            ),
          );
        }
        break;
      case 'narrative':
        break;
      default: {
        const _exhaustive: never = forbidden;
        errors.push(
          err(
            'FORBIDDEN_EXPECTATION_MALFORMED',
            `Unsupported forbidden expectation: ${String(_exhaustive)}`,
            `${path}.forbiddenExpectations[${index}]`,
          ),
        );
      }
    }
  }
}

function validateFixtureSourceBindings(
  fixture: FixtureDefinition,
  context: FixtureValidationContext,
  path: string,
  errors: FixtureValidationError[],
): void {
  for (const [index, binding] of fixture.sourceBindings.entries()) {
    const resolved = context.resolveSource(binding.sourceId as SourceId);
    if (!resolved) {
      errors.push(
        err(
          'FIXTURE_SOURCE_MISSING',
          `Source ${binding.sourceId} not found`,
          `${path}.sourceBindings[${index}].sourceId`,
        ),
      );
      continue;
    }
    if (resolved.sourceContentFingerprint !== binding.sourceContentFingerprint) {
      errors.push(
        err(
          'FIXTURE_FINGERPRINT_MISMATCH',
          `Source fingerprint mismatch for ${binding.sourceId}`,
          `${path}.sourceBindings[${index}].sourceContentFingerprint`,
          {
            expected: binding.sourceContentFingerprint,
            actual: resolved.sourceContentFingerprint,
          },
        ),
      );
    }
  }
}

function validatePackCompatibility(
  fixture: FixtureDefinition,
  context: FixtureValidationContext,
  path: string,
  errors: FixtureValidationError[],
): void {
  const compat = fixture.packCompatibility;
  switch (compat.mode) {
    case 'domain_independent':
      if (context.domainId !== undefined && compat.domainId !== context.domainId) {
        errors.push(
          err(
            'FIXTURE_INCOMPATIBLE_WITH_PACK',
            `Fixture domain ${compat.domainId} incompatible with pack domain ${context.domainId}`,
            `${path}.packCompatibility`,
          ),
        );
      }
      break;
    case 'schema_version':
      if (context.schemaVersion !== undefined && compat.schemaVersion !== context.schemaVersion) {
        errors.push(
          err(
            'FIXTURE_INCOMPATIBLE_WITH_PACK',
            `Fixture requires schema ${compat.schemaVersion}, pack has ${context.schemaVersion}`,
            `${path}.packCompatibility`,
          ),
        );
      }
      break;
    case 'pinned_pack':
      if (context.packContentHash !== undefined && compat.packContentHash !== context.packContentHash) {
        errors.push(
          err(
            'FIXTURE_INCOMPATIBLE_WITH_PACK',
            'Fixture pinned packContentHash does not match target pack',
            `${path}.packCompatibility.packContentHash`,
            { expected: compat.packContentHash, actual: context.packContentHash },
          ),
        );
      }
      if (context.packId !== undefined && compat.packId !== context.packId) {
        errors.push(
          err(
            'FIXTURE_INCOMPATIBLE_WITH_PACK',
            'Fixture pinned packId does not match target pack',
            `${path}.packCompatibility.packId`,
          ),
        );
      }
      if (context.packVersion !== undefined && compat.packVersion !== context.packVersion) {
        errors.push(
          err(
            'FIXTURE_INCOMPATIBLE_WITH_PACK',
            'Fixture pinned packVersion does not match target pack',
            `${path}.packCompatibility.packVersion`,
          ),
        );
      }
      break;
    default: {
      const _exhaustive: never = compat;
      errors.push(
        err(
          'FIXTURE_MALFORMED',
          `Unknown pack compatibility mode: ${String(_exhaustive)}`,
          `${path}.packCompatibility`,
        ),
      );
    }
  }
}

function validateGoldFactDuplicates(
  goldFacts: readonly GoldFact[],
  path: string,
  errors: FixtureValidationError[],
): void {
  const seen = new Set<string>();
  for (const [index, gold] of goldFacts.entries()) {
    if (seen.has(gold.id)) {
      errors.push(
        err(
          'GOLD_FACT_DUPLICATE_ID',
          `Duplicate gold fact id ${gold.id}`,
          `${path}.goldFacts[${index}].id`,
        ),
      );
    } else {
      seen.add(gold.id);
    }
  }
}

export function validateFixtureDefinition(
  fixture: unknown,
  registries: PackRegistries,
  context: FixtureValidationContext,
  path = 'fixture',
): FixtureValidationResult {
  const parsed = FixtureDefinitionSchema.safeParse(fixture);
  if (!parsed.success) {
    return fail([
      err(
        'FIXTURE_MALFORMED',
        parsed.error.issues.map((i) => i.message).join('; '),
        path,
      ),
    ]);
  }

  const errors: FixtureValidationError[] = [];
  const f = parsed.data as unknown as FixtureDefinition;

  validateFixtureSourceBindings(f, context, path, errors);
  validatePackCompatibility(f, context, path, errors);
  validateGoldFactDuplicates(f.goldFacts, path, errors);

  for (const docTypeId of f.applicableDocumentTypeIds) {
    if (!registries.documentTypes.has(docTypeId)) {
      errors.push(
        err(
          'GOLD_REFERENCE_UNRESOLVED',
          `Unknown applicableDocumentTypeId ${docTypeId}`,
          `${path}.applicableDocumentTypeIds`,
        ),
      );
    }
  }

  for (const binding of f.sourceBindings) {
    if (!registries.documentTypes.has(binding.documentTypeId)) {
      errors.push(
        err(
          'GOLD_REFERENCE_UNRESOLVED',
          `Unknown documentTypeId ${binding.documentTypeId} on source binding`,
          `${path}.sourceBindings`,
        ),
      );
    }
  }

  for (const [index, gold] of f.goldFacts.entries()) {
    const goldParsed = GoldFactSchema.safeParse(gold);
    if (!goldParsed.success) {
      errors.push(
        err(
          'GOLD_INVALID_VALUE',
          goldParsed.error.issues.map((i) => i.message).join('; '),
          `${path}.goldFacts[${index}]`,
        ),
      );
      continue;
    }
    validateGoldFactReferences(gold, registries, `${path}.goldFacts[${index}]`, errors);
  }

  for (const [index, ruleOutcome] of f.expectedRuleOutcomes.entries()) {
    if (!registries.rules.has(ruleOutcome.ruleId)) {
      errors.push(
        err(
          'GOLD_REFERENCE_UNRESOLVED',
          `Unknown ruleId ${ruleOutcome.ruleId}`,
          `${path}.expectedRuleOutcomes[${index}].ruleId`,
        ),
      );
    }
  }

  if (f.expectedOutput !== undefined) {
    if (!registries.outputSpecifications.has(f.expectedOutput.specificationId)) {
      errors.push(
        err(
          'GOLD_REFERENCE_UNRESOLVED',
          `Unknown output specification ${f.expectedOutput.specificationId}`,
          `${path}.expectedOutput.specificationId`,
        ),
      );
    }
  }

  validateForbiddenExpectations(f, registries, path, errors);

  return errors.length ? fail(errors) : pass();
}

export function validateFixtureCorpus(
  corpus: unknown,
  registries: PackRegistries,
  context: FixtureValidationContext,
): FixtureValidationResult {
  const parsed = FixtureCorpusSchema.safeParse(corpus);
  if (!parsed.success) {
    return fail([
      err(
        'FIXTURE_MALFORMED',
        parsed.error.issues.map((i) => i.message).join('; '),
        'corpus',
      ),
    ]);
  }

  const errors: FixtureValidationError[] = [];
  const c = parsed.data as unknown as FixtureCorpus;
  const seenFixtureIds = new Set<string>();

  for (const [index, fixture] of c.standaloneFixtures.entries()) {
    const result = validateFixtureDefinition(
      fixture,
      registries,
      context,
      `standaloneFixtures[${index}]`,
    );
    errors.push(...result.errors);
    if (seenFixtureIds.has(fixture.id)) {
      errors.push(
        err('FIXTURE_DUPLICATE_ID', `Duplicate fixture id ${fixture.id}`, `standaloneFixtures[${index}].id`),
      );
    } else {
      seenFixtureIds.add(fixture.id);
    }
  }

  for (const [caseIndex, fixtureCase] of c.cases.entries()) {
    for (const [fixIndex, fixture] of fixtureCase.fixtures.entries()) {
      const result = validateFixtureDefinition(
        fixture,
        registries,
        context,
        `cases[${caseIndex}].fixtures[${fixIndex}]`,
      );
      errors.push(...result.errors);
      if (seenFixtureIds.has(fixture.id)) {
        errors.push(
          err(
            'FIXTURE_DUPLICATE_ID',
            `Duplicate fixture id ${fixture.id}`,
            `cases[${caseIndex}].fixtures[${fixIndex}].id`,
          ),
        );
      } else {
        seenFixtureIds.add(fixture.id);
      }
    }

    validateGoldFactDuplicates(
      fixtureCase.crossDocumentGoldFacts,
      `cases[${caseIndex}].crossDocumentGoldFacts`,
      errors,
    );
    for (const [goldIndex, gold] of fixtureCase.crossDocumentGoldFacts.entries()) {
      validateGoldFactReferences(
        gold,
        registries,
        `cases[${caseIndex}].crossDocumentGoldFacts[${goldIndex}]`,
        errors,
      );
    }
  }

  return errors.length ? fail(errors) : pass();
}

export function validateProposedFixtureBundle(proposal: unknown): FixtureValidationResult {
  const parsed = ProposedFixtureBundleSchema.safeParse(proposal);
  if (!parsed.success) {
    return fail([
      err(
        'FIXTURE_MALFORMED',
        parsed.error.issues.map((i) => i.message).join('; '),
        'proposal',
      ),
    ]);
  }
  return pass();
}

export function assertAcceptedFixtureCorpus(
  corpus: FixtureCorpus,
  expectedCorpusHash: string,
): FixtureValidationResult {
  const actual = computeFixtureCorpusHash(corpus);
  if (actual !== expectedCorpusHash) {
    return fail([
      err('CORPUS_MISMATCH', 'Fixture corpus hash does not match expected binding', 'corpus', {
        expected: expectedCorpusHash,
        actual,
      }),
    ]);
  }
  return pass();
}

export function isProposedFixtureBundle(value: unknown): value is ProposedFixtureBundle {
  return ProposedFixtureBundleSchema.safeParse(value).success;
}
