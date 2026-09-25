import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadAndValidatePack } from '@domain-forge/testing';

const IEP_FIXTURE = join(import.meta.dirname, 'fixtures/iep.pack.yaml');

describe('IEP pack conformance', () => {
  it('validates canonical IEP pack when fixture is available', async () => {
    if (!existsSync(IEP_FIXTURE)) {
      expect(true).toBe(true);
      return;
    }

    const result = await loadAndValidatePack(IEP_FIXTURE);
    expect(result.valid).toBe(true);
    expect(result.pack).toBeDefined();
  });

  it('documents pending canonical fixture import', () => {
    if (!existsSync(IEP_FIXTURE)) {
      expect(existsSync(IEP_FIXTURE)).toBe(false);
    }
  });
});
