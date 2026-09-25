import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { safeParseDomainPackV0, type DomainPackV0 } from '@hive/pack-contract';

export interface ConformanceResult {
  valid: boolean;
  pack?: DomainPackV0;
  errors: string[];
  provenance?: string;
}

/** Load and validate an external Domain Pack against @hive/pack-contract */
export async function loadAndValidatePack(filePath: string): Promise<ConformanceResult> {
  const raw = await readFile(filePath, 'utf8');
  let parsed: unknown;

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    parsed = parseYaml(raw);
  } else {
    parsed = JSON.parse(raw);
  }

  const result = safeParseDomainPackV0(parsed);
  if (result.success) {
    return { valid: true, pack: result.data, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
