import { describe, it, expect } from 'vitest';
import {
  transitionForgeRun,
  transitionPackVersion,
  FORGE_RUN_STATES,
  PACK_VERSION_STATES,
  LifecycleTransitionError,
  buildRegistry,
  RegistryError,
} from '@domain-forge/core';
import { satisfiesMinVersion } from '@domain-forge/certification';
import { parseEvidenceLocator } from '@domain-forge/evidence';
import { acceptExtractionProposal } from '@domain-forge/validation';
import { buildExtractionAcceptanceContext } from '@domain-forge/validation';
import { createPackRegistries } from '@domain-forge/core';
import { createMinimalTestPack } from '@domain-forge/testing';
import type { ProposedExtraction } from '@domain-forge/contracts';

describe('adversarial: mutation and property-style tests', () => {
  describe('PackVersion illegal state pairs', () => {
    const illegalPairs: Array<[string, string]> = [];
    for (const from of PACK_VERSION_STATES) {
      for (const to of PACK_VERSION_STATES) {
        if (from === to) illegalPairs.push([from, to]);
      }
    }

    it.each(illegalPairs)('rejects same-state transition %s → %s', (from, to) => {
      expect(() => transitionPackVersion(from as never, to as never)).toThrow(LifecycleTransitionError);
    });
  });

  describe('ForgeRun terminal state exit attempts', () => {
    it.each(['COMPLETED', 'FAILED'] as const)('rejects exit from terminal state %s', (state) => {
      for (const target of FORGE_RUN_STATES) {
        if (target === state) continue;
        expect(() => transitionForgeRun(state, target)).toThrow(LifecycleTransitionError);
      }
    });
  });

  describe('malformed locator ranges', () => {
    const badLocators = [
      { kind: 'page', page: 0 },
      { kind: 'page', page: -1 },
      { kind: 'line_range', startLine: 5, endLine: 3 },
      { kind: 'character_span', startOffset: 10, endOffset: 5 },
      { kind: 'field_path', path: '' },
      { kind: 'paragraph', index: -1 },
    ];

    it.each(badLocators)('rejects malformed locator %o', (locator) => {
      const result = parseEvidenceLocator(locator);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.code).toBe('EVIDENCE_LOCATOR_INVALID');
    });
  });

  describe('semver capability comparison table', () => {
    const cases: Array<[string, string, boolean]> = [
      ['1.0.0', '1.0.0', true],
      ['2.0.0', '1.0.0', true],
      ['1.0.0', '2.0.0', false],
      ['0.9.9', '1.0.0', false],
      ['1.0.1', '1.0.0', true],
    ];

    it.each(cases)('satisfiesMinVersion(%s, %s) === %s', (version, min, expected) => {
      expect(satisfiesMinVersion(version, min)).toBe(expected);
    });
  });

  describe('registry ID validation', () => {
    it('rejects empty registry entry id', () => {
      expect(() => buildRegistry('test', [{ id: '', description: 'bad' }])).toThrow(RegistryError);
    });

    it('rejects alias collision across entries', () => {
      expect(() =>
        buildRegistry('test', [
          { id: 'a', description: 'A', aliases: ['x'] },
          { id: 'b', description: 'B', aliases: ['x'] },
        ]),
      ).toThrow(RegistryError);
    });
  });

  describe('missingness combinations on extraction', () => {
    it('allows NOT_PRESENT when escape hatch exists on default test contract', () => {
      const pack = createMinimalTestPack();
      const registries = createPackRegistries(pack);
      const context = buildExtractionAcceptanceContext(registries);
      const proposal: ProposedExtraction = {
        source: 'MODEL',
        contractId: 'extract-fact-001',
        factId: 'fact-001',
        outcomes: [{ kind: 'missingness', state: 'NOT_PRESENT' }],
        documentTypeId: 'doc-type-001',
        evidence: [],
      };
      const outcome = acceptExtractionProposal(proposal, context, {
        resolveSource: () => undefined,
        getSourceNormalizedText: () => '',
      });
      expect(outcome.result.valid).toBe(true);
    });

    it('rejects value plus missingness contradiction for exactly_one cardinality', () => {
      const pack = createMinimalTestPack();
      const registries = createPackRegistries(pack);
      const context = buildExtractionAcceptanceContext(registries);
      const proposal: ProposedExtraction = {
        source: 'MODEL',
        contractId: 'extract-fact-001',
        factId: 'fact-001',
        outcomes: [
          { kind: 'value', value: { kind: 'date', value: '2024-01-01' } },
          { kind: 'missingness', state: 'NOT_PRESENT' },
        ],
        documentTypeId: 'doc-type-001',
        evidence: [],
      };
      const outcome = acceptExtractionProposal(proposal, context, {
        resolveSource: () => undefined,
        getSourceNormalizedText: () => '',
      });
      expect(outcome.result.valid).toBe(false);
      expect(outcome.result.errors.some((e) => e.code === 'EXTRACTION_INVALID_CARDINALITY')).toBe(true);
    });
  });
});
