import { hashObject } from '@domain-forge/core';
import type {
  OutputClaimTypeDefinition,
  OutputSectionDefinition,
  OutputRuleOutcomeId,
} from '@hive/pack-contract';
import {
  ACCEPTED_OUTPUT_BRAND,
  VALIDATED_CLAIM_BRAND,
  VALIDATED_NARRATIVE_BRAND,
  VALIDATED_SUPPORT_CHIP_BRAND,
  type AcceptedOutput,
  type AcceptedOutputSection,
  type AcceptedSectionItem,
  type DocumentRequestOutputItem,
  type EntityTableRowOutputItem,
  type FindingOutputItem,
  type OutputAcceptanceContext,
  type OutputFieldValue,
  type OutputValidationError,
  type OutputValidationResult,
  type ProposedClaim,
  type ProposedNarrativeStatement,
  type ProposedOutput,
  type ProposedSupportChipRef,
  type QuestionListOutputItem,
  type TimelineEventOutputItem,
  type ValidatedClaim,
  type ValidatedNarrativeStatement,
  type ValidatedSupportChip,
} from '@domain-forge/contracts';

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
  context?: Readonly<Record<string, unknown>>,
): OutputValidationError {
  return {
    code,
    message,
    ...(path !== undefined ? { path } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}

function resolveSupportChip(
  ref: ProposedSupportChipRef,
  context: OutputAcceptanceContext,
  path: string,
  errors: OutputValidationError[],
): ValidatedSupportChip | undefined {
  switch (ref.kind) {
    case 'extraction': {
      const extraction = context.resolveExtraction(ref.extractionHash);
      if (!extraction) {
        errors.push(err('OUTPUT_MISSING_CLAIM_SUPPORT', `Unknown extraction ${ref.extractionHash}`, path));
        return undefined;
      }
      return Object.freeze({
        [VALIDATED_SUPPORT_CHIP_BRAND]: true as const,
        kind: 'extraction' as const,
        extractionHash: extraction.extractionHash,
        factId: extraction.factId,
        contractId: extraction.contractId,
      });
    }
    case 'rule_outcome': {
      const record = context.resolveRuleOutcome(ref.ruleId);
      if (!record) {
        errors.push(err('OUTPUT_MISSING_CLAIM_SUPPORT', `Unknown rule outcome for ${ref.ruleId}`, path));
        return undefined;
      }
      if (record.outcome !== ref.outcome) {
        errors.push(
          err(
            'OUTPUT_RULE_OUTCOME_SEMANTICS',
            `Rule ${ref.ruleId} outcome mismatch: expected ${ref.outcome}, got ${record.outcome}`,
            path,
          ),
        );
        return undefined;
      }
      return Object.freeze({
        [VALIDATED_SUPPORT_CHIP_BRAND]: true as const,
        kind: 'rule_outcome' as const,
        ruleId: record.ruleId,
        outcome: record.outcome,
        outcomeHash: record.outcomeHash,
      });
    }
    case 'entity_instance': {
      const instance = context.resolveEntityInstance(ref.entityId, ref.instanceId);
      if (!instance) {
        errors.push(
          err('OUTPUT_INVALID_REFERENCE', `Unknown entity instance ${ref.entityId}/${ref.instanceId}`, path),
        );
        return undefined;
      }
      return Object.freeze({
        [VALIDATED_SUPPORT_CHIP_BRAND]: true as const,
        kind: 'entity_instance' as const,
        entityId: instance.entityId,
        instanceId: instance.instanceId,
      });
    }
    case 'evidence': {
      const evidence = context.resolveEvidence(ref.evidenceReferenceHash);
      if (!evidence) {
        errors.push(
          err('OUTPUT_INVALID_EVIDENCE', `Unknown evidence ${ref.evidenceReferenceHash}`, path),
        );
        return undefined;
      }
      return Object.freeze({
        [VALIDATED_SUPPORT_CHIP_BRAND]: true as const,
        kind: 'evidence' as const,
        evidenceReferenceHash: evidence.evidenceReferenceHash,
      });
    }
    default: {
      const _exhaustive: never = ref;
      errors.push(err('OUTPUT_GUARD_FAILURE', `Unsupported chip ref kind: ${_exhaustive}`, path));
      return undefined;
    }
  }
}

function chipKey(chip: ValidatedSupportChip): string {
  switch (chip.kind) {
    case 'extraction':
      return `extraction:${chip.extractionHash}`;
    case 'rule_outcome':
      return `rule_outcome:${chip.ruleId}:${chip.outcome}`;
    case 'entity_instance':
      return `entity:${chip.entityId}:${chip.instanceId}`;
    case 'evidence':
      return `evidence:${chip.evidenceReferenceHash}`;
    default: {
      const _exhaustive: never = chip;
      return String(_exhaustive);
    }
  }
}

function satisfiesSupportRequirement(
  requirement: OutputClaimTypeDefinition['supportRequirements'][number],
  chips: readonly ValidatedSupportChip[],
): boolean {
  const matching = chips.filter((chip) => {
    switch (requirement.kind) {
      case 'extraction':
        return chip.kind === 'extraction' && chip.factId === requirement.factId;
      case 'rule_outcome':
        return (
          chip.kind === 'rule_outcome' &&
          chip.ruleId === requirement.ruleId &&
          (requirement.allowedRuleOutcomes === undefined ||
            requirement.allowedRuleOutcomes.includes(chip.outcome))
        );
      case 'entity_instance':
        return chip.kind === 'entity_instance' && chip.entityId === requirement.entityId;
      case 'evidence':
        return chip.kind === 'evidence';
      default:
        return false;
    }
  });
  return matching.length >= (requirement.minCount ?? 1);
}

function deriveClaimStatus(
  claimType: OutputClaimTypeDefinition,
  chips: readonly ValidatedSupportChip[],
): 'validated' | 'undetermined' | 'rejected' {
  const ruleChip = chips.find((c) => c.kind === 'rule_outcome');
  if (ruleChip?.kind === 'rule_outcome' && ruleChip.outcome === 'UNDETERMINED') {
    return claimType.permitsUndetermined ? 'undetermined' : 'rejected';
  }
  const allRequirementsMet = claimType.supportRequirements.every((req) => satisfiesSupportRequirement(req, chips));
  return allRequirementsMet ? 'validated' : 'rejected';
}

function acceptClaimProposal(
  proposal: ProposedClaim,
  claimType: OutputClaimTypeDefinition | undefined,
  context: OutputAcceptanceContext,
  errors: OutputValidationError[],
): ValidatedClaim | undefined {
  const path = `claims.${proposal.claimId}`;
  if (!claimType) {
    errors.push(err('OUTPUT_UNSUPPORTED_CLAIM', `Unknown claimTypeId ${proposal.claimTypeId}`, path));
    return undefined;
  }

  const chips: ValidatedSupportChip[] = [];
  for (const [index, ref] of proposal.supportRefs.entries()) {
    const chip = resolveSupportChip(ref, context, `${path}.supportRefs[${index}]`, errors);
    if (chip) {
      chips.push(chip);
    }
  }

  const deduped = [...new Map(chips.map((c) => [chipKey(c), c])).values()];
  const status = deriveClaimStatus(claimType, deduped);
  if (status === 'rejected') {
    errors.push(err('OUTPUT_MISSING_CLAIM_SUPPORT', `Claim ${proposal.claimId} lacks required support chips`, path));
    return undefined;
  }

  for (const req of claimType.supportRequirements) {
    if (!satisfiesSupportRequirement(req, deduped)) {
      errors.push(
        err('OUTPUT_MISSING_CLAIM_SUPPORT', `Claim ${proposal.claimId} missing support for ${req.kind}`, path),
      );
      return undefined;
    }
  }

  const provenance = deduped.flatMap((chip) => context.buildProvenanceForChip(chip));
  const claimHash = hashObject({
    claimTypeId: proposal.claimTypeId,
    claimId: proposal.claimId,
    entityId: proposal.entityId,
    status,
    chips: deduped.map(chipKey),
  });

  return Object.freeze({
    [VALIDATED_CLAIM_BRAND]: true as const,
    source: 'VALIDATED' as const,
    claimTypeId: proposal.claimTypeId,
    claimId: proposal.claimId,
    ...(proposal.entityId !== undefined ? { entityId: proposal.entityId } : {}),
    status,
    supportChips: Object.freeze([...deduped]),
    provenance: Object.freeze([...provenance]),
    claimHash,
  });
}

function acceptNarrativeProposal(
  proposal: ProposedNarrativeStatement,
  section: OutputSectionDefinition | undefined,
  acceptedClaims: ReadonlyMap<string, ValidatedClaim>,
  errors: OutputValidationError[],
): ValidatedNarrativeStatement | undefined {
  const path = `narratives.${proposal.statementId}`;

  if (!proposal.text.trim()) {
    errors.push(err('OUTPUT_MALFORMED_PROPOSAL', 'Narrative text is required', path));
    return undefined;
  }

  if (section !== undefined && !section.narrativePermissions.allowed) {
    errors.push(err('OUTPUT_INVALID_NARRATIVE_LINKAGE', `Narrative not permitted for section ${section.id}`, path));
    return undefined;
  }

  if (section?.narrativePermissions.requiresClaimRefs && proposal.claimRefs.length === 0) {
    errors.push(err('OUTPUT_INVALID_NARRATIVE_LINKAGE', 'Narrative requires claim references', path));
    return undefined;
  }

  let linkageValid = true;
  for (const claimRef of proposal.claimRefs) {
    const claim = acceptedClaims.get(claimRef);
    if (!claim) {
      errors.push(err('OUTPUT_INVALID_NARRATIVE_LINKAGE', `Unknown claim reference ${claimRef}`, path));
      linkageValid = false;
      continue;
    }
    if (claim.status === 'rejected') {
      errors.push(err('OUTPUT_INVALID_NARRATIVE_LINKAGE', `Narrative references rejected claim ${claimRef}`, path));
      linkageValid = false;
    }
    if (
      claim.status === 'undetermined' &&
      !(proposal.isUncertaintyStatement && section?.narrativePermissions.permitsUncertaintyStatements)
    ) {
      errors.push(
        err(
          'OUTPUT_INVALID_NARRATIVE_LINKAGE',
          `Narrative references undetermined claim ${claimRef} without uncertainty permission`,
          path,
        ),
      );
      linkageValid = false;
    }
  }

  if (!linkageValid) {
    return undefined;
  }

  if (proposal.isUncertaintyStatement && !section?.narrativePermissions.permitsUncertaintyStatements) {
    errors.push(err('OUTPUT_INVALID_NARRATIVE_LINKAGE', 'Uncertainty statements are not permitted', path));
    return undefined;
  }

  const narrativeHash = hashObject({
    statementId: proposal.statementId,
    text: proposal.text,
    claimRefs: proposal.claimRefs,
    sectionId: proposal.sectionId,
    isUncertaintyStatement: proposal.isUncertaintyStatement ?? false,
  });

  return Object.freeze({
    [VALIDATED_NARRATIVE_BRAND]: true as const,
    source: 'VALIDATED' as const,
    statementId: proposal.statementId,
    text: proposal.text,
    claimRefs: Object.freeze([...proposal.claimRefs]),
    ...(proposal.sectionId !== undefined ? { sectionId: proposal.sectionId } : {}),
    isUncertaintyStatement: proposal.isUncertaintyStatement ?? false,
    narrativeHash,
  });
}

function readStringField(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' ? value : undefined;
}

function parseFieldValue(raw: unknown, path: string, errors: OutputValidationError[]): OutputFieldValue | undefined {
  if (raw === null || raw === undefined) {
    return { kind: 'empty' };
  }
  if (typeof raw !== 'object') {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Field value must be an object', path));
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const kind = value['kind'];
  const state = value['state'];
  if (kind === 'missingness' && (state === 'NOT_PRESENT' || state === 'UNDETERMINED')) {
    return { kind: 'missingness', state };
  }
  if (kind === 'empty') return { kind: 'empty' };
  if (kind === 'null_not_applicable') return { kind: 'null_not_applicable' };
  if (kind === 'string' && typeof value['value'] === 'string') {
    return { kind: 'string', value: value['value'] };
  }
  if (kind === 'number' && typeof value['value'] === 'number' && Number.isFinite(value['value'])) {
    return { kind: 'number', value: value['value'] };
  }
  if (kind === 'boolean' && typeof value['value'] === 'boolean') {
    return { kind: 'boolean', value: value['value'] };
  }
  if (kind === 'date' && typeof value['value'] === 'string') {
    return { kind: 'date', value: value['value'] };
  }
  if (kind === 'reference' && typeof value['refId'] === 'string') {
    return { kind: 'reference', refId: value['refId'] };
  }
  errors.push(err('OUTPUT_INVALID_SECTION_FIELD', `Malformed field value at ${path}`, path));
  return undefined;
}

function validateFindingItem(
  raw: Record<string, unknown>,
  section: OutputSectionDefinition,
  acceptedClaims: ReadonlyMap<string, ValidatedClaim>,
  path: string,
  errors: OutputValidationError[],
): FindingOutputItem | undefined {
  const claimRef = readStringField(raw, 'claimRef');
  if (claimRef === undefined || !claimRef.trim()) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Finding requires claimRef', path));
    return undefined;
  }
  const claim = acceptedClaims.get(claimRef);
  if (!claim) {
    errors.push(err('OUTPUT_INVALID_CLAIM', `Finding references unknown claim ${claimRef}`, path));
    return undefined;
  }
  if (claim.status === 'rejected') {
    errors.push(err('OUTPUT_INVALID_CLAIM', `Finding references rejected claim ${claimRef}`, path));
    return undefined;
  }

  const ruleOutcomeRef = raw['ruleOutcomeRef'] as
    | { ruleId?: string; outcome?: OutputRuleOutcomeId }
    | undefined;
  if (ruleOutcomeRef !== undefined) {
    if (ruleOutcomeRef.outcome === 'UNDETERMINED' && claim.status !== 'undetermined') {
      errors.push(
        err(
          'OUTPUT_RULE_OUTCOME_SEMANTICS',
          'Affirmative finding cannot arise from UNDETERMINED rule without uncertainty claim',
          path,
        ),
      );
    }
    if (ruleOutcomeRef.outcome === 'NOT_FIRED') {
      errors.push(
        err('OUTPUT_RULE_OUTCOME_SEMANTICS', 'Affirmative finding cannot arise from NOT_FIRED rule outcome', path),
      );
    }
  }

  const undetermined = raw['undetermined'] === true || claim.status === 'undetermined';
  if (undetermined && !section.narrativePermissions.permitsUncertaintyStatements && section.claimTypeIds.length > 0) {
    const claimTypePermits = claim.status === 'undetermined';
    if (!claimTypePermits) {
      errors.push(err('OUTPUT_RULE_OUTCOME_SEMANTICS', 'Undetermined finding not permitted by section', path));
    }
  }

  const factId = readStringField(raw, 'factId');
  const entityId = readStringField(raw, 'entityId');
  const evidenceRefs = raw['evidenceRefs'];
  return {
    itemId: readStringField(raw, 'itemId') ?? `${path}.item`,
    claimRef,
    ...(ruleOutcomeRef?.ruleId && ruleOutcomeRef.outcome
      ? { ruleOutcomeRef: { ruleId: ruleOutcomeRef.ruleId, outcome: ruleOutcomeRef.outcome } }
      : {}),
    ...(factId !== undefined ? { factId } : {}),
    ...(entityId !== undefined ? { entityId } : {}),
    ...(Array.isArray(evidenceRefs) ? { evidenceRefs: evidenceRefs as string[] } : {}),
    undetermined,
  };
}

function validateEntityRowItem(
  raw: Record<string, unknown>,
  section: OutputSectionDefinition,
  path: string,
  errors: OutputValidationError[],
): EntityTableRowOutputItem | undefined {
  const entityInstanceId = readStringField(raw, 'entityInstanceId');
  const entityId = readStringField(raw, 'entityId');
  if (entityInstanceId === undefined || entityId === undefined) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Entity row requires entityInstanceId and entityId', path));
    return undefined;
  }
  if (!section.sourceEntityIds.includes(entityId)) {
    errors.push(err('OUTPUT_INVALID_REFERENCE', `Entity ${entityId} not declared on section`, path));
    return undefined;
  }

  const fieldsRaw = raw['fields'];
  if (typeof fieldsRaw !== 'object' || fieldsRaw === null || Array.isArray(fieldsRaw)) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Entity row requires fields map', path));
    return undefined;
  }

  const fields: Record<string, OutputFieldValue> = {};
  for (const fieldDef of section.fields) {
    const fieldPath = `${path}.fields.${fieldDef.id}`;
    if (!(fieldDef.id in (fieldsRaw as Record<string, unknown>))) {
      if (fieldDef.required) {
        errors.push(err('OUTPUT_INVALID_SECTION_FIELD', `Missing required field ${fieldDef.id}`, fieldPath));
      }
      continue;
    }
    const parsed = parseFieldValue((fieldsRaw as Record<string, unknown>)[fieldDef.id], fieldPath, errors);
    if (parsed) {
      fields[fieldDef.id] = parsed;
    }
  }

  return {
    itemId: readStringField(raw, 'itemId') ?? entityInstanceId,
    entityInstanceId,
    entityId,
    fields,
  };
}

function validateTimelineItem(
  raw: Record<string, unknown>,
  section: OutputSectionDefinition,
  context: OutputAcceptanceContext,
  path: string,
  errors: OutputValidationError[],
): TimelineEventOutputItem | undefined {
  const factId = readStringField(raw, 'factId');
  const extractionHash = readStringField(raw, 'extractionHash');
  if (factId === undefined || extractionHash === undefined) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Timeline event requires factId and extractionHash', path));
    return undefined;
  }
  if (!section.sourceFactIds.includes(factId)) {
    errors.push(err('OUTPUT_INVALID_REFERENCE', `Timeline fact ${factId} not declared on section`, path));
    return undefined;
  }

  const extraction = context.resolveExtraction(extractionHash);
  if (!extraction || extraction.factId !== factId) {
    errors.push(err('OUTPUT_INVALID_REFERENCE', `Timeline extraction ${extractionHash} invalid for fact ${factId}`, path));
    return undefined;
  }

  const undetermined = raw['undetermined'] === true;
  const dateValue = readStringField(raw, 'dateValue');
  const partialDate = raw['partialDate'] as TimelineEventOutputItem['partialDate'] | undefined;

  if (!undetermined && dateValue === undefined && partialDate === undefined) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Timeline event requires dateValue, partialDate, or undetermined', path));
    return undefined;
  }
  if (dateValue !== undefined && partialDate !== undefined) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Timeline event cannot combine dateValue and partialDate', path));
    return undefined;
  }

  return {
    itemId: readStringField(raw, 'itemId') ?? extractionHash,
    factId,
    extractionHash,
    ...(dateValue !== undefined ? { dateValue } : {}),
    ...(partialDate !== undefined ? { partialDate } : {}),
    undetermined,
  };
}

function validateQuestionItem(
  raw: Record<string, unknown>,
  section: OutputSectionDefinition,
  path: string,
  errors: OutputValidationError[],
): QuestionListOutputItem | undefined {
  const questionId = readStringField(raw, 'questionId');
  if (questionId === undefined) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Question item requires questionId', path));
    return undefined;
  }
  if (!section.questionIds.includes(questionId)) {
    errors.push(err('OUTPUT_INVALID_QUESTION_REFERENCE', `Question ${questionId} not declared on section`, path));
    return undefined;
  }
  return { itemId: readStringField(raw, 'itemId') ?? questionId, questionId };
}

function validateDocumentRequestItem(
  raw: Record<string, unknown>,
  section: OutputSectionDefinition,
  path: string,
  errors: OutputValidationError[],
): DocumentRequestOutputItem | undefined {
  const documentTypeId = readStringField(raw, 'documentTypeId');
  if (documentTypeId === undefined) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Document request requires documentTypeId', path));
    return undefined;
  }
  if (!section.documentTypeIds.includes(documentTypeId)) {
    errors.push(
      err('OUTPUT_INVALID_DOCUMENT_REQUEST', `Document type ${documentTypeId} not declared on section`, path),
    );
    return undefined;
  }
  const missingFactId = readStringField(raw, 'missingFactId');
  if (missingFactId !== undefined && !section.missingFactIds.includes(missingFactId)) {
    errors.push(
      err('OUTPUT_INVALID_DOCUMENT_REQUEST', `Missing fact ${missingFactId} not declared on section`, path),
    );
    return undefined;
  }
  if (section.missingFactIds.length > 0 && missingFactId === undefined) {
    errors.push(err('OUTPUT_INVALID_DOCUMENT_REQUEST', 'Document request must trace to missingFactId', path));
    return undefined;
  }
  const reasonKey = readStringField(raw, 'reasonKey');
  return {
    itemId: readStringField(raw, 'itemId') ?? documentTypeId,
    documentTypeId,
    ...(missingFactId !== undefined ? { missingFactId } : {}),
    ...(reasonKey !== undefined ? { reasonKey } : {}),
  };
}

function validateSnapshotItem(
  raw: Record<string, unknown>,
  section: OutputSectionDefinition,
  path: string,
  errors: OutputValidationError[],
): AcceptedSectionItem | undefined {
  const fieldsRaw = raw['fields'];
  if (typeof fieldsRaw !== 'object' || fieldsRaw === null || Array.isArray(fieldsRaw)) {
    errors.push(err('OUTPUT_INVALID_SECTION_FIELD', 'Snapshot requires fields map', path));
    return undefined;
  }
  const fields: Record<string, OutputFieldValue> = {};
  for (const fieldDef of section.fields) {
    const fieldPath = `${path}.fields.${fieldDef.id}`;
    if (!(fieldDef.id in (fieldsRaw as Record<string, unknown>))) {
      if (fieldDef.required) {
        errors.push(err('OUTPUT_INVALID_SECTION_FIELD', `Missing required snapshot field ${fieldDef.id}`, fieldPath));
      }
      continue;
    }
    const parsed = parseFieldValue((fieldsRaw as Record<string, unknown>)[fieldDef.id], fieldPath, errors);
    if (parsed) {
      fields[fieldDef.id] = parsed;
    }
  }
  return {
    sectionType: 'CASE_SNAPSHOT',
    item: {
      itemId: readStringField(raw, 'itemId') ?? 'snapshot',
      fields,
    },
  };
}

function validateSectionItems(
  section: OutputSectionDefinition,
  items: readonly Record<string, unknown>[],
  acceptedClaims: ReadonlyMap<string, ValidatedClaim>,
  context: OutputAcceptanceContext,
  path: string,
  errors: OutputValidationError[],
): AcceptedSectionItem[] {
  const count = items.length;
  if (count < section.cardinality.minItems) {
    errors.push(
      err(
        'OUTPUT_INVALID_CARDINALITY',
        `Section ${section.id} requires at least ${section.cardinality.minItems} items, got ${count}`,
        path,
      ),
    );
  }
  if (section.cardinality.maxItems !== undefined && count > section.cardinality.maxItems) {
    errors.push(
      err(
        'OUTPUT_INVALID_CARDINALITY',
        `Section ${section.id} allows at most ${section.cardinality.maxItems} items, got ${count}`,
        path,
      ),
    );
  }

  const accepted: AcceptedSectionItem[] = [];
  items.forEach((raw, index) => {
    const itemPath = `${path}.items[${index}]`;
    switch (section.sectionType) {
      case 'FINDINGS_LIST': {
        const finding = validateFindingItem(raw, section, acceptedClaims, itemPath, errors);
        if (finding) accepted.push({ sectionType: 'FINDINGS_LIST', item: finding });
        break;
      }
      case 'ENTITY_TABLE': {
        const row = validateEntityRowItem(raw, section, itemPath, errors);
        if (row) accepted.push({ sectionType: 'ENTITY_TABLE', item: row });
        break;
      }
      case 'TIMELINE': {
        const event = validateTimelineItem(raw, section, context, itemPath, errors);
        if (event) accepted.push({ sectionType: 'TIMELINE', item: event });
        break;
      }
      case 'QUESTION_LIST': {
        const question = validateQuestionItem(raw, section, itemPath, errors);
        if (question) accepted.push({ sectionType: 'QUESTION_LIST', item: question });
        break;
      }
      case 'DOCUMENT_REQUESTS': {
        const request = validateDocumentRequestItem(raw, section, itemPath, errors);
        if (request) accepted.push({ sectionType: 'DOCUMENT_REQUESTS', item: request });
        break;
      }
      case 'CASE_SNAPSHOT': {
        const snapshot = validateSnapshotItem(raw, section, itemPath, errors);
        if (snapshot) accepted.push(snapshot);
        break;
      }
      default:
        errors.push(
          err('OUTPUT_UNSUPPORTED_SECTION_TYPE', `Unsupported section type ${section.sectionType}`, itemPath),
        );
    }
  });

  return accepted;
}

/**
 * Deterministic acceptance boundary:
 * model proposal → schema/guard validation → accepted output | structured rejection
 */
export function acceptOutputProposal(
  proposal: ProposedOutput,
  context: OutputAcceptanceContext,
): { accepted?: AcceptedOutput; result: OutputValidationResult } {
  const errors: OutputValidationError[] = [];

  if (proposal.source !== 'MODEL') {
    errors.push(err('OUTPUT_MALFORMED_PROPOSAL', 'Only MODEL-sourced proposals are accepted at this boundary', 'source'));
  }
  if (!proposal.specificationId.trim()) {
    errors.push(err('OUTPUT_MALFORMED_PROPOSAL', 'specificationId is required', 'specificationId'));
    return { result: fail(errors) };
  }

  const specification = context.resolveSpecification(proposal.specificationId);
  if (!specification) {
    return {
      result: fail([
        err('OUTPUT_SPECIFICATION_NOT_FOUND', `Output specification not found: ${proposal.specificationId}`, 'specificationId'),
      ]),
    };
  }

  const specContentHash = context.specificationContentHash(specification);
  const sectionById = new Map(specification.sections.map((s) => [s.id, s]));
  const claimTypeById = new Map(specification.claimTypes.map((c) => [c.id, c]));

  const acceptedClaims = new Map<string, ValidatedClaim>();
  for (const claimProposal of proposal.claims) {
    const claimType = claimTypeById.get(claimProposal.claimTypeId);
    const accepted = acceptClaimProposal(claimProposal, claimType, context, errors);
    if (accepted) {
      acceptedClaims.set(accepted.claimId, accepted);
    }
  }

  const acceptedNarratives: ValidatedNarrativeStatement[] = [];
  for (const narrativeProposal of proposal.narratives) {
    const section =
      narrativeProposal.sectionId !== undefined ? sectionById.get(narrativeProposal.sectionId) : undefined;
    if (narrativeProposal.sectionId !== undefined && section === undefined) {
      errors.push(
        err(
          'OUTPUT_INVALID_REFERENCE',
          `Unknown narrative sectionId ${narrativeProposal.sectionId}`,
          `narratives.${narrativeProposal.statementId}`,
        ),
      );
      continue;
    }
    const accepted = acceptNarrativeProposal(narrativeProposal, section, acceptedClaims, errors);
    if (accepted) {
      acceptedNarratives.push(accepted);
    }
  }

  const acceptedSections: AcceptedOutputSection[] = [];
  for (const sectionProposal of proposal.sections) {
    const section = sectionById.get(sectionProposal.sectionId);
    const path = `sections.${sectionProposal.sectionId}`;
    if (!section) {
      errors.push(err('OUTPUT_INVALID_REFERENCE', `Unknown sectionId ${sectionProposal.sectionId}`, path));
      continue;
    }

    const items = validateSectionItems(
      section,
      sectionProposal.items,
      acceptedClaims,
      context,
      path,
      errors,
    );

    acceptedSections.push({
      sectionId: section.id,
      sectionType: section.sectionType as AcceptedOutputSection['sectionType'],
      items: Object.freeze(items.map((entry) => entry.item)),
    });
  }

  if (errors.length) {
    return { result: fail(errors) };
  }

  const outputHash = hashObject({
    specificationId: proposal.specificationId,
    specificationContentHash: specContentHash,
    sections: acceptedSections,
    claims: [...acceptedClaims.values()].map((c) => c.claimHash),
    narratives: acceptedNarratives.map((n) => n.narrativeHash),
  });

  const accepted = Object.freeze({
    [ACCEPTED_OUTPUT_BRAND]: true as const,
    source: 'VALIDATED' as const,
    specificationId: proposal.specificationId,
    specificationContentHash: specContentHash,
    sections: Object.freeze([...acceptedSections]),
    claims: Object.freeze([...acceptedClaims.values()]),
    narratives: Object.freeze([...acceptedNarratives]),
    outputHash,
  }) as AcceptedOutput;

  return { accepted, result: pass() };
}
