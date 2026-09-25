import { describe, it, expect } from 'vitest';
import { createPackVersion } from '@domain-forge/packs';
import { createMinimalTestPack } from '@domain-forge/testing';
import { acceptExtractionProposal } from '@domain-forge/validation';
import { buildExtractionAcceptanceContext } from '@domain-forge/validation';
import { createPackRegistries } from '@domain-forge/core';
import type { ProposedExtraction } from '@domain-forge/contracts';
import { PackCompositionError } from '@hive/pack-contract';
import { composeDomainPack, minimalDomainPack } from '@hive/pack-contract';
import { checkRuntimeEligibility } from '../../apps/cli/src/services/runtime-eligibility-check.js';
import { createInMemoryRepositories } from '@domain-forge/persistence';
import { applyPackVersionTransition } from '@domain-forge/packs';
import { ExitCode } from '../../apps/cli/src/exit-codes.js';
import { transitionPackVersion, LifecycleTransitionError } from '@domain-forge/core';

describe('adversarial: error code stability', () => {
  it('extraction acceptance preserves machine-readable error codes', () => {
    const pack = createMinimalTestPack();
    const registries = createPackRegistries(pack);
    const context = buildExtractionAcceptanceContext(registries);
    const proposal: ProposedExtraction = {
      source: 'MODEL',
      contractId: 'nonexistent-contract',
      factId: 'fact-001',
      outcomes: [],
      evidence: [],
    };
    const outcome = acceptExtractionProposal(proposal, context, {
      resolveSource: () => undefined,
      getSourceNormalizedText: () => '',
    });
    expect(outcome.result.valid).toBe(false);
    expect(outcome.result.errors.every((e) => typeof e.code === 'string' && e.code.length > 0)).toBe(true);
    expect(outcome.result.errors[0]?.code).toBe('EXTRACTION_CONTRACT_NOT_FOUND');
  });

  it('composition errors expose stable PackCompositionError codes', () => {
    const root = minimalDomainPack({
      dependencies: {
        extends: [
          { packId: 'missing', packVersion: '1.0.0', packContentHash: 'a'.repeat(64) },
        ],
        overlay: [],
        shared: [],
      },
    });
    try {
      composeDomainPack(root, new Map());
      expect.fail('Expected PackCompositionError');
    } catch (error) {
      expect(error).toBeInstanceOf(PackCompositionError);
      expect((error as PackCompositionError).code).toBe('DEPENDENCY_NOT_FOUND');
    }
  });

  it('CLI runtime-eligibility preserves reason codes through service layer', async () => {
    const repos = createInMemoryRepositories();
    const pack = createMinimalTestPack();
    let packVersion = createPackVersion(pack.packId, pack.packVersion, pack);
    packVersion = applyPackVersionTransition(packVersion, 'PROMOTE_TO_PROVISIONAL').packVersion;
    packVersion = applyPackVersionTransition(packVersion, 'CERTIFY').packVersion;
    await repos.packVersions.insert(packVersion);

    const result = await checkRuntimeEligibility(
      {
        repos,
        rootDir: process.cwd(),
        dataDir: process.cwd(),
        outputFormat: 'json',
        qualificationProfilesDir: '',
        certificationProfilesDir: '',
      },
      {
        packVersionId: packVersion.id,
        hiveVersion: 'hive-test-1.0.0',
        suppliedCapabilities: [],
      },
    );

    expect(result.exitCode).toBe(ExitCode.VALIDATION_FAILURE);
    expect(result.errors?.[0]?.code).toBe('CERTIFICATION_MISSING');
  });

  it('lifecycle transition errors use LifecycleTransitionError with stable shape', () => {
    expect(() => transitionPackVersion('CERTIFIED', 'DRAFT')).toThrow(LifecycleTransitionError);
  });
});
