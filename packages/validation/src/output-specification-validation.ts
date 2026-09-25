import { hashObject, type PackRegistries } from '@domain-forge/core';
import { OutputSectionTypeRegistry, RuleOutcomeRegistry } from '@domain-forge/core';
import {
  OutputSpecificationEntrySchema,
  type DomainPackV0,
  type OutputSpecificationEntry,
} from '@hive/pack-contract';
import type { OutputValidationError, OutputValidationResult } from '@domain-forge/contracts';

function fail(errors: OutputValidationError[]): OutputValidationResult {
  return { valid: false, errors };
}

function pass(): OutputValidationResult {
  return { valid: true, errors: [] };
}

function err(
  code: OutputValidationError['code'],
  message: string,
  path?: string,
): OutputValidationError {
  return path !== undefined ? { code, message, path } : { code, message };
}

const SECTION_TYPE_REQUIREMENTS: Readonly<
  Record<
    string,
    {
      readonly requiresFields?: boolean;
      readonly requiresQuestionIds?: boolean;
      readonly requiresDocumentTypeIds?: boolean;
      readonly requiresSourceEntityIds?: boolean;
      readonly requiresSourceFactIds?: boolean;
      readonly requiresClaimTypeIds?: boolean;
      readonly requiresTimeModelId?: boolean;
    }
  >
> = {
  FINDINGS_LIST: { requiresClaimTypeIds: true, requiresFields: true },
  ENTITY_TABLE: { requiresSourceEntityIds: true, requiresFields: true },
  TIMELINE: { requiresSourceFactIds: true, requiresFields: true, requiresTimeModelId: true },
  QUESTION_LIST: { requiresQuestionIds: true, requiresFields: true },
  DOCUMENT_REQUESTS: { requiresDocumentTypeIds: true, requiresFields: true },
  CASE_SNAPSHOT: { requiresSourceFactIds: true, requiresFields: true },
};

function validateSectionReferences(
  spec: OutputSpecificationEntry,
  specIndex: number,
  sectionIndex: number,
  section: OutputSpecificationEntry['sections'][number],
  registries: PackRegistries,
  claimTypeIds: Set<string>,
  sectionIds: Set<string>,
  errors: OutputValidationError[],
): void {
  const basePath = `outputSpecifications[${specIndex}].sections[${sectionIndex}]`;

  if (!OutputSectionTypeRegistry.has(section.sectionType)) {
    errors.push(
      err(
        'OUTPUT_UNSUPPORTED_SECTION_TYPE',
        `Unknown sectionType ${section.sectionType}`,
        `${basePath}.sectionType`,
      ),
    );
  }

  const requirements = SECTION_TYPE_REQUIREMENTS[section.sectionType];
  if (requirements?.requiresClaimTypeIds && section.claimTypeIds.length === 0) {
    errors.push(
      err('OUTPUT_SPECIFICATION_MALFORMED', 'FINDINGS_LIST requires claimTypeIds', `${basePath}.claimTypeIds`),
    );
  }
  if (requirements?.requiresFields && section.fields.length === 0) {
    errors.push(err('OUTPUT_SPECIFICATION_MALFORMED', 'Section requires fields', `${basePath}.fields`));
  }
  if (requirements?.requiresQuestionIds && section.questionIds.length === 0) {
    errors.push(
      err('OUTPUT_SPECIFICATION_MALFORMED', 'QUESTION_LIST requires questionIds', `${basePath}.questionIds`),
    );
  }
  if (requirements?.requiresDocumentTypeIds && section.documentTypeIds.length === 0) {
    errors.push(
      err(
        'OUTPUT_SPECIFICATION_MALFORMED',
        'DOCUMENT_REQUESTS requires documentTypeIds',
        `${basePath}.documentTypeIds`,
      ),
    );
  }
  if (requirements?.requiresSourceEntityIds && section.sourceEntityIds.length === 0) {
    errors.push(
      err(
        'OUTPUT_SPECIFICATION_MALFORMED',
        'ENTITY_TABLE requires sourceEntityIds',
        `${basePath}.sourceEntityIds`,
      ),
    );
  }
  if (requirements?.requiresSourceFactIds && section.sourceFactIds.length === 0) {
    errors.push(
      err(
        'OUTPUT_SPECIFICATION_MALFORMED',
        'Section requires sourceFactIds',
        `${basePath}.sourceFactIds`,
      ),
    );
  }
  if (requirements?.requiresTimeModelId && section.timeModelId === undefined) {
    errors.push(
      err('OUTPUT_SPECIFICATION_MALFORMED', 'TIMELINE requires timeModelId', `${basePath}.timeModelId`),
    );
  }

  for (const factId of section.sourceFactIds) {
    if (!registries.facts.has(factId)) {
      errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown sourceFactId ${factId}`, `${basePath}.sourceFactIds`));
    }
  }
  for (const ruleId of section.sourceRuleIds) {
    if (!registries.rules.has(ruleId)) {
      errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown sourceRuleId ${ruleId}`, `${basePath}.sourceRuleIds`));
    }
  }
  for (const entityId of section.sourceEntityIds) {
    if (!registries.entities.has(entityId)) {
      errors.push(
        err('OUTPUT_INVALID_REFERENCE', `Unknown sourceEntityId ${entityId}`, `${basePath}.sourceEntityIds`),
      );
    }
  }
  for (const claimTypeId of section.claimTypeIds) {
    if (!claimTypeIds.has(claimTypeId)) {
      errors.push(
        err('OUTPUT_INVALID_CLAIM', `Unknown claimTypeId ${claimTypeId}`, `${basePath}.claimTypeIds`),
      );
    }
  }
  for (const questionId of section.questionIds) {
    if (!registries.questions.has(questionId)) {
      errors.push(
        err('OUTPUT_INVALID_QUESTION_REFERENCE', `Unknown questionId ${questionId}`, `${basePath}.questionIds`),
      );
    }
  }
  for (const documentTypeId of section.documentTypeIds) {
    if (!registries.documentTypes.has(documentTypeId)) {
      errors.push(
        err(
          'OUTPUT_INVALID_DOCUMENT_REQUEST',
          `Unknown documentTypeId ${documentTypeId}`,
          `${basePath}.documentTypeIds`,
        ),
      );
    }
  }
  for (const missingFactId of section.missingFactIds) {
    if (!registries.facts.has(missingFactId)) {
      errors.push(
        err('OUTPUT_INVALID_REFERENCE', `Unknown missingFactId ${missingFactId}`, `${basePath}.missingFactIds`),
      );
    }
  }
  if (section.timeModelId !== undefined && !registries.timeModels.has(section.timeModelId)) {
    errors.push(
      err('OUTPUT_INVALID_REFERENCE', `Unknown timeModelId ${section.timeModelId}`, `${basePath}.timeModelId`),
    );
  }

  if (section.visibility?.ruleId !== undefined && !registries.rules.has(section.visibility.ruleId)) {
    errors.push(
      err('OUTPUT_INVALID_REFERENCE', `Unknown visibility ruleId`, `${basePath}.visibility.ruleId`),
    );
  }
  if (section.visibility?.requiredOutcome !== undefined && !RuleOutcomeRegistry.has(section.visibility.requiredOutcome)) {
    errors.push(
      err('OUTPUT_INVALID_REFERENCE', `Unknown visibility requiredOutcome`, `${basePath}.visibility.requiredOutcome`),
    );
  }
  if (section.visibility?.factId !== undefined && !registries.facts.has(section.visibility.factId)) {
    errors.push(
      err('OUTPUT_INVALID_REFERENCE', `Unknown visibility factId`, `${basePath}.visibility.factId`),
    );
  }

  for (const [fieldIndex, field] of section.fields.entries()) {
    const fieldPath = `${basePath}.fields[${fieldIndex}]`;
    if (field.claimTypeId !== undefined && !claimTypeIds.has(field.claimTypeId)) {
      errors.push(err('OUTPUT_INVALID_CLAIM', `Unknown field claimTypeId ${field.claimTypeId}`, fieldPath));
    }
    if (field.factId !== undefined && !registries.facts.has(field.factId)) {
      errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown field factId ${field.factId}`, fieldPath));
    }
    if (field.entityId !== undefined && !registries.entities.has(field.entityId)) {
      errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown field entityId ${field.entityId}`, fieldPath));
    }
    if (field.ruleId !== undefined && !registries.rules.has(field.ruleId)) {
      errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown field ruleId ${field.ruleId}`, fieldPath));
    }
    if (field.questionId !== undefined && !registries.questions.has(field.questionId)) {
      errors.push(err('OUTPUT_INVALID_QUESTION_REFERENCE', `Unknown field questionId ${field.questionId}`, fieldPath));
    }
    if (field.documentTypeId !== undefined && !registries.documentTypes.has(field.documentTypeId)) {
      errors.push(
        err('OUTPUT_INVALID_DOCUMENT_REQUEST', `Unknown field documentTypeId ${field.documentTypeId}`, fieldPath),
      );
    }
  }

  if (spec.audience === 'customer') {
    for (const excludedId of spec.customerConstraints?.excludedSectionIds ?? []) {
      if (!sectionIds.has(excludedId)) {
        errors.push(
          err(
            'OUTPUT_INVALID_REFERENCE',
            `customerConstraints references unknown sectionId ${excludedId}`,
            `outputSpecifications[${specIndex}].customerConstraints.excludedSectionIds`,
          ),
        );
      }
    }
  }
}

/** Validate output specification entries against pack registries — fail closed on dangling refs. */
export function validateOutputSpecificationReferences(
  pack: DomainPackV0,
  registries: PackRegistries,
): OutputValidationResult {
  const errors: OutputValidationError[] = [];
  const seenSpecIds = new Set<string>();

  for (const [specIndex, entry] of pack.outputSpecifications.entries()) {
    const parsed = OutputSpecificationEntrySchema.safeParse(entry);
    if (!parsed.success) {
      errors.push(
        err(
          'OUTPUT_SPECIFICATION_MALFORMED',
          parsed.error.issues.map((i) => i.message).join('; '),
          `outputSpecifications[${specIndex}]`,
        ),
      );
      continue;
    }

    if (seenSpecIds.has(entry.id)) {
      errors.push(
        err(
          'OUTPUT_SPECIFICATION_MALFORMED',
          `Duplicate output specification id "${entry.id}"`,
          `outputSpecifications[${specIndex}].id`,
        ),
      );
    } else {
      seenSpecIds.add(entry.id);
    }

    const spec = parsed.data;
    const claimTypeIds = new Set(spec.claimTypes.map((c) => c.id));
    const sectionIds = new Set(spec.sections.map((s) => s.id));

    for (const [claimIndex, claimType] of spec.claimTypes.entries()) {
      for (const [reqIndex, req] of claimType.supportRequirements.entries()) {
        const reqPath = `outputSpecifications[${specIndex}].claimTypes[${claimIndex}].supportRequirements[${reqIndex}]`;
        if (req.factId !== undefined && !registries.facts.has(req.factId)) {
          errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown support factId ${req.factId}`, reqPath));
        }
        if (req.ruleId !== undefined && !registries.rules.has(req.ruleId)) {
          errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown support ruleId ${req.ruleId}`, reqPath));
        }
        if (req.entityId !== undefined && !registries.entities.has(req.entityId)) {
          errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown support entityId ${req.entityId}`, reqPath));
        }
        for (const outcome of req.allowedRuleOutcomes ?? []) {
          if (!RuleOutcomeRegistry.has(outcome)) {
            errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown allowedRuleOutcome ${outcome}`, reqPath));
          }
        }
      }
    }

    for (const [sectionIndex, section] of spec.sections.entries()) {
      validateSectionReferences(spec, specIndex, sectionIndex, section, registries, claimTypeIds, sectionIds, errors);
    }
  }

  return errors.length ? fail(errors) : pass();
}

/** Expose completeness validation for provisional gate (Step 15). */
export function validateOutputSpecificationCompleteness(pack: DomainPackV0): OutputValidationResult {
  const errors: OutputValidationError[] = [];
  const contractFactIds = new Set(pack.extractionContracts.map((c) => c.factId));

  for (const [specIndex, spec] of pack.outputSpecifications.entries()) {
    for (const [sectionIndex, section] of spec.sections.entries()) {
      const factIds = new Set([
        ...section.sourceFactIds,
        ...section.missingFactIds,
        ...section.fields.filter((f) => f.factId !== undefined).map((f) => f.factId as string),
      ]);
      for (const factId of factIds) {
        if (!contractFactIds.has(factId)) {
          errors.push(
            err(
              'OUTPUT_GUARD_FAILURE',
              `Output section references fact ${factId} without extraction contract entry`,
              `outputSpecifications[${specIndex}].sections[${sectionIndex}]`,
            ),
          );
        }
      }
    }
  }

  return errors.length ? fail(errors) : pass();
}

export function buildOutputAcceptanceContext(registries: PackRegistries): {
  resolveSpecification: (specificationId: string) => OutputSpecificationEntry | undefined;
  specificationContentHash: (spec: OutputSpecificationEntry) => string;
} {
  const byId = new Map(registries.outputSpecifications.list().map((entry) => [entry.id, entry]));
  return {
    resolveSpecification: (specificationId) => byId.get(specificationId),
    specificationContentHash: (spec) => hashObject(spec),
  };
}
