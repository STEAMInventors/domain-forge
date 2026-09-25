import { InvariantViolationError } from '../errors.js';

export type RegistryErrorCode =
  | 'REGISTRY_MALFORMED_ENTRY'
  | 'REGISTRY_DUPLICATE_ID'
  | 'REGISTRY_DUPLICATE_ALIAS'
  | 'REGISTRY_UNKNOWN_ENTRY'
  | 'REGISTRY_AMBIGUOUS_ALIAS'
  | 'REGISTRY_UNSUPPORTED_VERSION'
  | 'REGISTRY_CONFLICT'
  | 'REGISTRY_INVALID_REFERENCE';

export interface RegistryErrorDetails {
  registry: string;
  code: RegistryErrorCode;
  entryId?: string;
  alias?: string;
  reference?: string;
  referenceRegistry?: string;
  [key: string]: unknown;
}

export class RegistryError extends InvariantViolationError {
  readonly registry: string;
  readonly registryCode: RegistryErrorCode;

  constructor(message: string, details: RegistryErrorDetails) {
    super(message, details);
    this.name = 'RegistryError';
    this.registry = details.registry;
    this.registryCode = details.code;
  }
}
