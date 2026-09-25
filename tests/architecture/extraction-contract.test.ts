import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createPackRegistries } from '@domain-forge/core';
import { isAcceptedExtraction } from '@domain-forge/contracts';
import { acceptExtractionProposal, buildExtractionAcceptanceContext } from '@domain-forge/validation';
import { createMinimalTestPack } from '@domain-forge/testing';

const ROOT = join(import.meta.dirname, '../..');
const PACK_CONTRACT = join(ROOT, 'packages/pack-contract/src');

describe('architecture: extraction contract', () => {
  it('@hive/pack-contract extraction schemas do not import Forge packages', () => {
    const file = join(PACK_CONTRACT, 'extraction-contract-v0.ts');
    const content = readFileSync(file, 'utf8');
    expect(content).not.toMatch(/@domain-forge\//);
  });

  it('extraction acceptance uses pack registries without domain-specific constants', () => {
    const forbidden = ['IEP', 'Medicaid', 'BIP'];
    const file = join(ROOT, 'packages/validation/src/extraction-acceptance.ts');
    const content = readFileSync(file, 'utf8');
    for (const term of forbidden) {
      expect(content).not.toContain(term);
    }
  });

  it('resolves extraction contracts from composed pack registries only', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
    registries.validateCrossReferences();
    const context = buildExtractionAcceptanceContext(registries);
    expect(context.resolveContract('extract-fact-001')?.factId).toBe('fact-001');
  });

  it('raw model-shaped objects are not accepted extractions', () => {
    const fakeAccepted = {
      source: 'VALIDATED',
      contractId: 'extract-fact-001',
      factId: 'fact-001',
      outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
      evidence: [],
      extractionHash: 'a'.repeat(64),
      contractContentHash: 'b'.repeat(64),
    };
    expect(isAcceptedExtraction(fakeAccepted)).toBe(false);
    const outcome = acceptExtractionProposal(
      {
        source: 'MODEL',
        contractId: 'extract-fact-001',
        factId: 'fact-001',
        outcomes: [{ kind: 'value', value: { kind: 'date', value: '2024-01-01' } }],
        documentTypeId: 'doc-type-001',
        evidence: [],
      },
      buildExtractionAcceptanceContext(createPackRegistries(createMinimalTestPack())),
      { resolveSource: () => undefined },
    );
    expect(outcome.result.valid).toBe(false);
  });
});
