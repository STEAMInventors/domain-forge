export type PackCompositionErrorCode =
  | 'DEPENDENCY_NOT_FOUND'
  | 'DEPENDENCY_HASH_MISMATCH'
  | 'DEPENDENCY_IDENTITY_MISMATCH'
  | 'DEPENDENCY_MALFORMED'
  | 'COMPOSITION_CYCLE_DETECTED'
  | 'COMPOSITION_CONFLICT'
  | 'COMPOSITION_INVALID';

export class PackCompositionError extends Error {
  readonly code: PackCompositionErrorCode;

  constructor(
    code: PackCompositionErrorCode,
    message: string,
    readonly path?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PackCompositionError';
    this.code = code;
  }
}
