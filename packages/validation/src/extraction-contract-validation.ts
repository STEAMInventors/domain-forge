import { hashObject } from '@domain-forge/core';
import type { PackRegistries } from '@domain-forge/core';
import {
  ExtractionContractEntrySchema,
  type DomainPackV0,
  type ExtractionContractEntry,
} from '@hive/pack-contract';
import type { ExtractionValidationError, ExtractionValidationResult } from '@domain-forge/contracts';

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
): ExtractionValidationError {
  return path !== undefined ? { code, message, path } : { code, message };
}

/** Validate extraction contract entries against pack registries — no dangling references. */
export function validateExtractionContractReferences(
  pack: DomainPackV0,
  registries: PackRegistries,
): ExtractionValidationResult {
  const errors: ExtractionValidationError[] = [];
  const seenIds = new Set<string>();

  for (const [index, entry] of pack.extractionContracts.entries()) {
    const parsed = ExtractionContractEntrySchema.safeParse(entry);
    if (!parsed.success) {
      errors.push(
        err(
          'EXTRACTION_CONTRACT_MALFORMED',
          parsed.error.issues.map((i) => i.message).join('; '),
          `extractionContracts[${index}]`,
        ),
      );
      continue;
    }

    if (seenIds.has(entry.id)) {
      errors.push(
        err(
          'EXTRACTION_CONTRACT_MALFORMED',
          `Duplicate extraction contract id "${entry.id}"`,
          `extractionContracts[${index}].id`,
        ),
      );
    } else {
      seenIds.add(entry.id);
    }

    if (!registries.facts.has(entry.factId)) {
      errors.push(
        err(
          'EXTRACTION_UNRESOLVED_REFERENCE',
          `Unknown factId ${entry.factId}`,
          `extractionContracts[${index}].factId`,
        ),
      );
    }

    if (entry.entityId !== undefined && !registries.entities.has(entry.entityId)) {
      errors.push(
        err(
          'EXTRACTION_UNRESOLVED_REFERENCE',
          `Unknown entityId ${entry.entityId}`,
          `extractionContracts[${index}].entityId`,
        ),
      );
    }

    for (const docTypeId of entry.documentTypeIds) {
      if (!registries.documentTypes.has(docTypeId)) {
        errors.push(
          err(
            'EXTRACTION_INCOMPATIBLE_DOCUMENT_TYPE',
            `Unknown documentTypeId ${docTypeId}`,
            `extractionContracts[${index}].documentTypeIds`,
          ),
        );
      }
    }

    for (const field of ['constructId', 'roleId', 'subjectId', 'unitId'] as const) {
      const termId = entry[field];
      if (termId !== undefined && !registries.vocabulary.has(termId)) {
        errors.push(
          err(
            field === 'unitId' ? 'EXTRACTION_INVALID_UNIT' : 'EXTRACTION_UNRESOLVED_REFERENCE',
            `Unknown vocabulary term for ${field}: ${termId}`,
            `extractionContracts[${index}].${field}`,
          ),
        );
      }
    }

    for (const vocabRef of entry.vocabularyRefs) {
      if (!registries.vocabulary.has(vocabRef)) {
        errors.push(
          err(
            'EXTRACTION_UNRESOLVED_REFERENCE',
            `Unknown vocabularyRefs entry ${vocabRef}`,
            `extractionContracts[${index}].vocabularyRefs`,
          ),
        );
      }
    }

    for (const hint of entry.identityHints) {
      if (hint.entityId !== undefined && !registries.entities.has(hint.entityId)) {
        errors.push(
          err(
            'EXTRACTION_UNRESOLVED_REFERENCE',
            `Unknown identityHints entityId ${hint.entityId}`,
            `extractionContracts[${index}].identityHints`,
          ),
        );
      }
    }

    for (const constraint of entry.phrasingConstraints) {
      for (const factId of constraint.factIds) {
        if (!registries.facts.has(factId)) {
          errors.push(
            err(
              'EXTRACTION_UNRESOLVED_REFERENCE',
              `Unknown phrasingConstraints factId ${factId}`,
              `extractionContracts[${index}].phrasingConstraints`,
            ),
          );
        }
      }
    }
  }

  return errors.length ? fail(errors) : pass();
}

/** Every fact referenced by rules must have extraction guidance (architecture section 19). */
export function validateExtractionContractCompleteness(pack: DomainPackV0): ExtractionValidationResult {
  const contractFactIds = new Set(pack.extractionContracts.map((c) => c.factId));
  const errors: ExtractionValidationError[] = [];

  for (const rule of pack.rules) {
    for (const factId of rule.factIds) {
      if (!contractFactIds.has(factId)) {
        errors.push(
          err(
            'EXTRACTION_CONTRACT_NOT_FOUND',
            `Rule ${rule.id} references fact ${factId} without extraction contract entry`,
            `rules.${rule.id}.factIds`,
          ),
        );
      }
    }
  }

  return errors.length ? fail(errors) : pass();
}

export function buildExtractionAcceptanceContext(registries: PackRegistries): {
  resolveContract: (contractId: string) => ExtractionContractEntry | undefined;
  resolveFact: (factId: string) => { id: string; entityId: string } | undefined;
  resolveEntity: (entityId: string) => { id: string } | undefined;
  resolveDocumentType: (documentTypeId: string) => { id: string } | undefined;
  resolveVocabulary: (termId: string) => { id: string } | undefined;
  contractContentHash: (contract: ExtractionContractEntry) => string;
} {
  const byId = new Map(registries.extractionContracts.list().map((entry) => [entry.id, entry]));

  return {
    resolveContract: (contractId) => byId.get(contractId),
    resolveFact: (factId) => {
      if (!registries.facts.has(factId)) return undefined;
      return registries.facts.resolve(factId);
    },
    resolveEntity: (entityId) => {
      if (!registries.entities.has(entityId)) return undefined;
      return registries.entities.resolve(entityId);
    },
    resolveDocumentType: (documentTypeId) => {
      if (!registries.documentTypes.has(documentTypeId)) return undefined;
      return registries.documentTypes.resolve(documentTypeId);
    },
    resolveVocabulary: (termId) => {
      if (!registries.vocabulary.has(termId)) return undefined;
      return registries.vocabulary.resolve(termId);
    },
    contractContentHash: (contract) => hashObject(contract),
  };
}
