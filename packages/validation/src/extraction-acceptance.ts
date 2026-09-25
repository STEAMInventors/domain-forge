import { hashObject } from '@domain-forge/core';
import type {
  ExtractionContractEntry,
  ExtractionMissingnessState,
  ExtractionValueType,
} from '@hive/pack-contract';
import type {
  AcceptedExtraction,
  ExtractionAcceptanceContext,
  ExtractionOutcome,
  ExtractionValidationError,
  ExtractionValidationResult,
  ExtractionValue,
  ProposedExtraction,
} from '@domain-forge/contracts';
import { ACCEPTED_EXTRACTION_BRAND } from '@domain-forge/contracts';
import {
  acceptProposedEvidenceReferences,
  type EvidenceAcceptanceContext,
} from '@domain-forge/evidence';

function fail(errors: ExtractionValidationError[]): ExtractionValidationResult {
  return { valid: false, errors };
}

function pass(): ExtractionValidationResult {
  return { valid: true, errors: [] };
}

function err(
  code: ExtractionValidationError['code'],
  message: string,
  path?: string,
  context?: Readonly<Record<string, unknown>>,
): ExtractionValidationError {
  return {
    code,
    message,
    ...(path !== undefined ? { path } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateValueType(
  expectedType: ExtractionValueType,
  value: ExtractionValue,
  contract: ExtractionContractEntry,
  path: string,
  errors: ExtractionValidationError[],
): void {
  if (value.kind !== expectedType) {
    errors.push(
      err(
        'EXTRACTION_VALUE_TYPE_MISMATCH',
        `Expected value kind ${expectedType}, got ${value.kind}`,
        path,
        { expectedType, actualKind: value.kind },
      ),
    );
    return;
  }

  switch (value.kind) {
    case 'string':
      if (value.value.length === 0) {
        errors.push(err('EXTRACTION_VALUE_TYPE_MISMATCH', 'String value must be non-empty', path));
      }
      break;
    case 'number':
      if (!Number.isFinite(value.value)) {
        errors.push(err('EXTRACTION_VALUE_TYPE_MISMATCH', 'Number value must be finite', path));
      }
      break;
    case 'boolean':
      break;
    case 'date':
      if (!ISO_DATE_PATTERN.test(value.value)) {
        errors.push(err('EXTRACTION_VALUE_TYPE_MISMATCH', 'Date value must be ISO YYYY-MM-DD', path));
      }
      break;
    case 'money':
      if (!Number.isFinite(value.amount) || value.currency.length === 0) {
        errors.push(err('EXTRACTION_VALUE_TYPE_MISMATCH', 'Money requires finite amount and currency', path));
      }
      break;
    case 'duration':
    case 'quantity':
      if (!Number.isFinite(value.value)) {
        errors.push(
          err('EXTRACTION_VALUE_TYPE_MISMATCH', `${value.kind} requires finite numeric value`, path),
        );
      }
      if (!value.unitId.trim()) {
        errors.push(err('EXTRACTION_INVALID_UNIT', 'Unit id is required for duration/quantity values', path));
      } else if (contract.unitId !== undefined && value.unitId !== contract.unitId) {
        errors.push(
          err(
            'EXTRACTION_INVALID_UNIT',
            `Unit ${value.unitId} is incompatible with contract unit ${contract.unitId}`,
            path,
            { proposedUnitId: value.unitId, contractUnitId: contract.unitId },
          ),
        );
      }
      break;
    case 'enum':
      if (!contract.enumValues?.includes(value.value)) {
        errors.push(
          err(
            'EXTRACTION_VALUE_TYPE_MISMATCH',
            `Enum value ${value.value} is not declared on contract`,
            path,
            { allowed: contract.enumValues },
          ),
        );
      }
      break;
    case 'reference':
      if (!value.refId.trim()) {
        errors.push(err('EXTRACTION_UNRESOLVED_REFERENCE', 'Reference value requires refId', path));
      }
      break;
    case 'structured_object':
      if (Array.isArray(value.fields)) {
        errors.push(err('EXTRACTION_VALUE_TYPE_MISMATCH', 'Structured object requires fields map', path));
      }
      break;
    default: {
      const _exhaustive: never = value;
      errors.push(err('EXTRACTION_GUARD_FAILURE', `Unsupported value kind: ${_exhaustive}`, path));
    }
  }
}

function validateMissingnessAllowed(
  state: ExtractionMissingnessState,
  contract: ExtractionContractEntry,
  path: string,
  errors: ExtractionValidationError[],
): void {
  if (state === 'NOT_PRESENT' && contract.escapeHatches?.notPresent === undefined) {
    errors.push(
      err('EXTRACTION_GUARD_FAILURE', 'NOT_PRESENT is not permitted without escape hatch guidance', path),
    );
  }
  if (state === 'UNDETERMINED' && contract.escapeHatches?.undetermined === undefined) {
    errors.push(
      err('EXTRACTION_GUARD_FAILURE', 'UNDETERMINED is not permitted without escape hatch guidance', path),
    );
  }
}

function validateCardinality(
  outcomes: readonly ExtractionOutcome[],
  contract: ExtractionContractEntry,
  errors: ExtractionValidationError[],
): void {
  const count = outcomes.length;
  switch (contract.cardinality) {
    case 'exactly_one':
      if (count !== 1) {
        errors.push(
          err('EXTRACTION_INVALID_CARDINALITY', `Expected exactly one outcome, got ${count}`, 'outcomes', {
            cardinality: contract.cardinality,
            count,
          }),
        );
      }
      break;
    case 'zero_or_one':
      if (count > 1) {
        errors.push(
          err('EXTRACTION_INVALID_CARDINALITY', `Expected zero or one outcome, got ${count}`, 'outcomes', {
            cardinality: contract.cardinality,
            count,
          }),
        );
      }
      break;
    case 'one_or_more':
      if (count < 1) {
        errors.push(
          err('EXTRACTION_REQUIRED_VALUE_MISSING', 'At least one outcome is required', 'outcomes', {
            cardinality: contract.cardinality,
            count,
          }),
        );
      }
      break;
    case 'zero_or_more':
      break;
    default: {
      const _exhaustive: never = contract.cardinality;
      errors.push(
        err('EXTRACTION_GUARD_FAILURE', `Unknown cardinality: ${_exhaustive}`, 'outcomes'),
      );
    }
  }
}

function resolveReferenceValue(
  value: ExtractionValue & { kind: 'reference' },
  contract: ExtractionContractEntry,
  context: ExtractionAcceptanceContext,
  path: string,
  errors: ExtractionValidationError[],
): void {
  if (contract.referenceRegistry === 'vocabulary') {
    if (!context.resolveVocabulary(value.refId)) {
      errors.push(
        err('EXTRACTION_UNRESOLVED_REFERENCE', `Unknown vocabulary reference ${value.refId}`, path),
      );
    }
    return;
  }
  if (contract.referenceRegistry === 'entities') {
    if (!context.resolveEntity(value.refId)) {
      errors.push(err('EXTRACTION_UNRESOLVED_REFERENCE', `Unknown entity reference ${value.refId}`, path));
    }
  }
}

function validateDimensionRef(
  termId: string | undefined,
  field: 'constructId' | 'roleId' | 'subjectId',
  context: ExtractionAcceptanceContext,
  errors: ExtractionValidationError[],
): void {
  if (termId === undefined) {
    return;
  }
  if (!context.resolveVocabulary(termId)) {
    const code =
      field === 'constructId'
        ? 'EXTRACTION_UNRESOLVED_CONSTRUCT'
        : field === 'roleId'
          ? 'EXTRACTION_UNRESOLVED_ROLE'
          : 'EXTRACTION_UNRESOLVED_SUBJECT';
    errors.push(err(code, `Unknown vocabulary term for ${field}: ${termId}`, field));
  }
}

/**
 * Deterministic acceptance boundary:
 * model proposal → schema/guard validation → accepted extraction | structured rejection
 */
export function acceptExtractionProposal(
  proposal: ProposedExtraction,
  context: ExtractionAcceptanceContext,
  evidenceContext: EvidenceAcceptanceContext,
): { accepted?: AcceptedExtraction; result: ExtractionValidationResult } {
  const errors: ExtractionValidationError[] = [];

  if (proposal.source !== 'MODEL') {
    errors.push(
      err('EXTRACTION_MALFORMED_PROPOSAL', 'Only MODEL-sourced proposals are accepted at this boundary', 'source'),
    );
  }

  if (!proposal.contractId.trim()) {
    errors.push(err('EXTRACTION_MALFORMED_PROPOSAL', 'contractId is required', 'contractId'));
  }
  if (!proposal.factId.trim()) {
    errors.push(err('EXTRACTION_MALFORMED_PROPOSAL', 'factId is required', 'factId'));
  }
  if (!Array.isArray(proposal.outcomes)) {
    errors.push(err('EXTRACTION_MALFORMED_PROPOSAL', 'outcomes must be an array', 'outcomes'));
    return { result: fail(errors) };
  }

  const contract = context.resolveContract(proposal.contractId);
  if (!contract) {
    return {
      result: fail([
        err('EXTRACTION_CONTRACT_NOT_FOUND', `Extraction contract not found: ${proposal.contractId}`, 'contractId'),
      ]),
    };
  }

  if (contract.factId !== proposal.factId) {
    errors.push(
      err(
        'EXTRACTION_GUARD_FAILURE',
        `Proposal factId ${proposal.factId} does not match contract factId ${contract.factId}`,
        'factId',
      ),
    );
  }

  if (!context.resolveFact(contract.factId)) {
    errors.push(err('EXTRACTION_UNRESOLVED_REFERENCE', `Unknown fact ${contract.factId}`, 'factId'));
  }

  if (contract.entityId !== undefined && !context.resolveEntity(contract.entityId)) {
    errors.push(
      err('EXTRACTION_UNRESOLVED_REFERENCE', `Unknown contract entityId ${contract.entityId}`, 'entityId'),
    );
  }

  if (proposal.entityId !== undefined && !context.resolveEntity(proposal.entityId)) {
    errors.push(err('EXTRACTION_UNRESOLVED_REFERENCE', `Unknown proposal entityId ${proposal.entityId}`, 'entityId'));
  }

  if (contract.documentTypeIds.length > 0) {
    if (proposal.documentTypeId === undefined) {
      errors.push(
        err(
          'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE',
          'documentTypeId is required for this extraction contract',
          'documentTypeId',
        ),
      );
    } else if (!contract.documentTypeIds.includes(proposal.documentTypeId)) {
      errors.push(
        err(
          'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE',
          `Document type ${proposal.documentTypeId} is not applicable to contract ${contract.id}`,
          'documentTypeId',
          { allowed: contract.documentTypeIds },
        ),
      );
    } else if (!context.resolveDocumentType(proposal.documentTypeId)) {
      errors.push(
        err(
          'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE',
          `Unknown document type ${proposal.documentTypeId}`,
          'documentTypeId',
        ),
      );
    }
  }

  validateDimensionRef(proposal.constructId ?? contract.constructId, 'constructId', context, errors);
  validateDimensionRef(proposal.roleId ?? contract.roleId, 'roleId', context, errors);
  validateDimensionRef(proposal.subjectId ?? contract.subjectId, 'subjectId', context, errors);

  if (contract.unitId !== undefined && !context.resolveVocabulary(contract.unitId)) {
    errors.push(err('EXTRACTION_INVALID_UNIT', `Unknown contract unitId ${contract.unitId}`, 'unitId'));
  }

  validateCardinality(proposal.outcomes, contract, errors);

  proposal.outcomes.forEach((outcome, index) => {
    const path = `outcomes[${index}]`;
    if (outcome.kind === 'missingness') {
      validateMissingnessAllowed(outcome.state, contract, path, errors);
      return;
    }
    validateValueType(contract.expectedType, outcome.value, contract, `${path}.value`, errors);
    if (outcome.value.kind === 'reference') {
      resolveReferenceValue(outcome.value, contract, context, `${path}.value`, errors);
    }
  });

  const requiresEvidence =
    contract.evidence.required &&
    proposal.outcomes.some((o) => o.kind === 'value') &&
    !(
      proposal.outcomes.length === 1 &&
      proposal.outcomes[0]?.kind === 'missingness' &&
      proposal.outcomes[0].state === 'NOT_PRESENT'
    );

  if (requiresEvidence && proposal.evidence.length === 0) {
    errors.push(err('EXTRACTION_MISSING_EVIDENCE', 'Required evidence is missing', 'evidence'));
  }

  if (
    requiresEvidence &&
    contract.evidence.minCount > 0 &&
    proposal.evidence.length < contract.evidence.minCount
  ) {
    errors.push(
      err(
        'EXTRACTION_MISSING_EVIDENCE',
        `Expected at least ${contract.evidence.minCount} evidence references, got ${proposal.evidence.length}`,
        'evidence',
      ),
    );
  }

  if (
    requiresEvidence &&
    contract.evidence.maxCount !== undefined &&
    proposal.evidence.length > contract.evidence.maxCount
  ) {
    errors.push(
      err(
        'EXTRACTION_INVALID_CARDINALITY',
        `Expected at most ${contract.evidence.maxCount} evidence references, got ${proposal.evidence.length}`,
        'evidence',
      ),
    );
  }

  if (errors.length) {
    return { result: fail(errors) };
  }

  const evidenceOutcome = acceptProposedEvidenceReferences(
    requiresEvidence ? proposal.evidence : [],
    evidenceContext,
  );
  if (!evidenceOutcome.result.valid) {
    return {
      result: fail(
        evidenceOutcome.result.errors.map((e) =>
          err('EXTRACTION_INVALID_EVIDENCE', e.message, e.path ? `evidence.${e.path}` : 'evidence', {
            evidenceCode: e.code,
          }),
        ),
      ),
    };
  }

  if (requiresEvidence) {
    const unvalidated = proposal.evidence.some((e) => e.source !== 'MODEL');
    if (unvalidated) {
      return {
        result: fail([
          err('EXTRACTION_INVALID_EVIDENCE', 'Evidence proposals must originate from MODEL source', 'evidence'),
        ]),
      };
    }
  }

  const contractContentHash = context.contractContentHash(contract);
  const extractionHash = hashObject({
    contractId: proposal.contractId,
    factId: proposal.factId,
    contractContentHash,
    outcomes: proposal.outcomes,
    constructId: proposal.constructId ?? contract.constructId,
    roleId: proposal.roleId ?? contract.roleId,
    subjectId: proposal.subjectId ?? contract.subjectId,
    documentTypeId: proposal.documentTypeId,
    entityId: proposal.entityId ?? contract.entityId,
    evidence: evidenceOutcome.accepted.map((e) => e.evidenceReferenceHash),
  });

  const accepted = Object.freeze({
    [ACCEPTED_EXTRACTION_BRAND]: true as const,
    source: 'VALIDATED' as const,
    contractId: proposal.contractId,
    factId: proposal.factId,
    contractEntryId: contract.id,
    expectedType: contract.expectedType,
    cardinality: contract.cardinality,
    outcomes: Object.freeze([...proposal.outcomes]),
    ...(proposal.constructId !== undefined ? { constructId: proposal.constructId } : {}),
    ...(proposal.roleId !== undefined ? { roleId: proposal.roleId } : {}),
    ...(proposal.subjectId !== undefined ? { subjectId: proposal.subjectId } : {}),
    ...(proposal.documentTypeId !== undefined ? { documentTypeId: proposal.documentTypeId } : {}),
    ...(proposal.entityId !== undefined ? { entityId: proposal.entityId } : {}),
    evidence: Object.freeze([...evidenceOutcome.accepted]),
    extractionHash,
    contractContentHash,
  }) as AcceptedExtraction;

  return { accepted, result: pass() };
}
