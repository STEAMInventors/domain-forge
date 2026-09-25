import type { CertificationError, CertificationErrorCode } from '@domain-forge/contracts';

export function certificationError(
  code: CertificationErrorCode,
  message: string,
  path?: string,
  context?: Readonly<Record<string, unknown>>,
): CertificationError {
  return {
    code,
    message,
    ...(path !== undefined ? { path } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}
