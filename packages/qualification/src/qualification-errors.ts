import type { QualificationError } from '@domain-forge/contracts';

export function qualificationError(
  code: QualificationError['code'],
  message: string,
  path?: string,
  context?: Readonly<Record<string, unknown>>,
): QualificationError {
  return {
    code,
    message,
    ...(path !== undefined ? { path } : {}),
    ...(context !== undefined ? { context } : {}),
  };
}
