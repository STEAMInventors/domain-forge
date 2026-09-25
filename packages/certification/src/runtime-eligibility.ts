import { dependencyRefKey } from '@hive/pack-contract';
import type {
  CertificationRecord,
  PackVersion,
  RuntimeEligibilityContext,
  RuntimeEligibilityDecision,
  RuntimeEligibilityReason,
} from '@domain-forge/contracts';
import { DefaultCertificationStalenessEvaluator } from './certification-staleness.js';
import {
  computeRuntimeEligibilityFingerprint,
} from './certification-fingerprint.js';
import {
  evaluateCapabilityRequirements,
  toPackCapabilityRequirements,
} from './capability-requirements.js';

function ineligible(
  reasons: readonly RuntimeEligibilityReason[],
): RuntimeEligibilityDecision {
  return {
    status: 'ineligible',
    reasons,
    evaluatedAt: new Date().toISOString(),
  };
}

function eligible(
  packVersion: PackVersion,
  certification: CertificationRecord,
  context: RuntimeEligibilityContext,
): RuntimeEligibilityDecision {
  const fingerprint = computeRuntimeEligibilityFingerprint({
    packContentHash: packVersion.packContentHash,
    certificationRecordFingerprint: certification.recordFingerprint,
    hiveVersion: context.hiveVersion,
    ...(context.extractionModelFamily !== undefined
      ? { extractionModelFamily: context.extractionModelFamily }
      : {}),
    ...(context.extractionModelVersion !== undefined
      ? { extractionModelVersion: context.extractionModelVersion }
      : {}),
    ...(context.extractionPolicyVersion !== undefined
      ? { extractionPolicyVersion: context.extractionPolicyVersion }
      : {}),
    ...(context.packCompositionHash !== undefined
      ? { packCompositionHash: context.packCompositionHash }
      : {}),
  });

  return {
    status: 'eligible',
    reasons: [],
    eligibilityFingerprint: fingerprint,
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluateRuntimeEligibility(
  packVersion: PackVersion,
  certification: CertificationRecord | undefined,
  context: RuntimeEligibilityContext,
): RuntimeEligibilityDecision {
  const reasons: RuntimeEligibilityReason[] = [];

  if (packVersion.state === 'SUSPENDED') {
    return ineligible([
      {
        code: 'PACK_SUSPENDED',
        message: 'Pack version is suspended and not runtime eligible',
      },
    ]);
  }

  if (packVersion.state === 'SUPERSEDED') {
    return ineligible([
      {
        code: 'PACK_SUPERSEDED',
        message: 'Superseded pack versions are not eligible for new runtime use',
      },
    ]);
  }

  if (packVersion.state !== 'CERTIFIED') {
    reasons.push({
      code: 'PACK_NOT_CERTIFIED',
      message: `Pack version state ${packVersion.state} is not CERTIFIED`,
    });
  }

  if (certification === undefined) {
    reasons.push({
      code: 'CERTIFICATION_MISSING',
      message: 'No CertificationRecord exists for this pack version',
    });
    return ineligible(reasons);
  }

  if (certification.decision.kind !== 'certified') {
    reasons.push({
      code: 'CERTIFICATION_NOT_CERTIFIED',
      message: `Certification decision is ${certification.decision.kind}`,
    });
  }

  if (certification.packContentHash !== packVersion.packContentHash) {
    reasons.push({
      code: 'CERTIFICATION_PACK_MISMATCH',
      message: 'CertificationRecord pack content hash does not match PackVersion',
      context: {
        certificationHash: certification.packContentHash,
        packVersionHash: packVersion.packContentHash,
      },
    });
  }

  if (certification.packId !== packVersion.packId || certification.packVersion !== packVersion.version) {
    reasons.push({
      code: 'CERTIFICATION_PACK_MISMATCH',
      message: 'CertificationRecord pack identity does not match PackVersion',
    });
  }

  const stalenessEvaluator = new DefaultCertificationStalenessEvaluator();
  const qualificationFingerprint =
    context.currentQualificationRecord?.recordFingerprint ??
    certification.qualificationRecordFingerprint;

  const staleness = stalenessEvaluator.evaluate(certification, {
    packContentHash: packVersion.packContentHash,
    ...(context.packCompositionHash !== undefined
      ? { packCompositionHash: context.packCompositionHash }
      : certification.packCompositionHash !== undefined
        ? { packCompositionHash: certification.packCompositionHash }
        : {}),
    qualificationRecordFingerprint: qualificationFingerprint,
    fixtureCorpusHash: certification.fixtureCorpusHash,
    ...(packVersion.authorityCorpusHash !== undefined
      ? { authorityCorpusHash: packVersion.authorityCorpusHash }
      : certification.authorityCorpusHash !== undefined
        ? { authorityCorpusHash: certification.authorityCorpusHash }
        : {}),
    certificationProfileId: certification.certificationProfileId,
    certificationProfileVersion: certification.certificationProfileVersion,
  });

  if (staleness.isStale) {
    reasons.push({
      code: 'CERTIFICATION_STALE',
      message: `Certification is stale: ${staleness.reasons.join(', ')}`,
      context: { reasons: staleness.reasons },
    });
  }

  if (
    context.currentQualificationRecord !== undefined &&
    context.currentQualificationRecord.recordFingerprint !==
      certification.qualificationRecordFingerprint
  ) {
    reasons.push({
      code: 'QUALIFICATION_MISMATCH',
      message: 'Current QualificationRecord fingerprint does not match certification binding',
      context: {
        certificationFingerprint: certification.qualificationRecordFingerprint,
        currentFingerprint: context.currentQualificationRecord.recordFingerprint,
      },
    });
  }

  if (context.qualificationStalenessEvaluator !== undefined && context.currentQualificationRecord !== undefined) {
    const qualStaleness = context.qualificationStalenessEvaluator.evaluate(
      context.currentQualificationRecord,
      {
        packContentHash: packVersion.packContentHash,
        ...(context.packCompositionHash !== undefined
          ? { packCompositionHash: context.packCompositionHash }
          : {}),
        fixtureCorpusHash: context.currentQualificationRecord.identity.fixtureCorpusHash,
        ...(packVersion.authorityCorpusHash !== undefined
          ? { authorityCorpusHash: packVersion.authorityCorpusHash }
          : {}),
        qualificationProfileId: context.currentQualificationRecord.identity.qualificationProfileId,
        qualificationProfileVersion:
          context.currentQualificationRecord.identity.qualificationProfileVersion,
        ...(context.extractionModelFamily !== undefined &&
        context.extractionModelVersion !== undefined &&
        context.extractionPolicyVersion !== undefined
          ? {
              extractionRuntime: {
                hiveVersion: context.hiveVersion,
                extractionModelFamily: context.extractionModelFamily,
                extractionModelVersion: context.extractionModelVersion,
                extractionPolicyVersion: context.extractionPolicyVersion,
              },
            }
          : {}),
      },
    );

    if (qualStaleness.isStale) {
      reasons.push({
        code: 'QUALIFICATION_STALE',
        message: `Current extraction qualification is stale: ${qualStaleness.reasons.join(', ')}`,
        context: { reasons: qualStaleness.reasons },
      });
    }
  }

  const extractionQual = context.currentQualificationRecord?.extractionQualification;
  if (extractionQual !== undefined) {
    if (extractionQual.state === 'STALE') {
      reasons.push({
        code: 'EXTRACTION_QUALIFICATION_STALE',
        message: 'ExtractionQualification state is STALE',
      });
    } else if (extractionQual.state !== 'QUALIFIED') {
      reasons.push({
        code: 'EXTRACTION_QUALIFICATION_NOT_QUALIFIED',
        message: `ExtractionQualification state is ${extractionQual.state}`,
      });
    }
  }

  const capabilityRequirements = toPackCapabilityRequirements(
    packVersion.packContent.capabilityRequirements,
  );
  reasons.push(
    ...evaluateCapabilityRequirements(capabilityRequirements, context.suppliedCapabilities),
  );

  const dependencyLayers = [
    ...packVersion.packContent.dependencies.extends,
    ...packVersion.packContent.dependencies.overlay,
    ...packVersion.packContent.dependencies.shared,
  ];

  if (context.dependencyEligibility !== undefined) {
    for (const dependency of dependencyLayers) {
      const key = dependencyRefKey(dependency);
      const depDecision = context.dependencyEligibility.get(key);
      if (depDecision === undefined || depDecision.status !== 'eligible') {
        reasons.push({
          code: 'DEPENDENCY_NOT_ELIGIBLE',
          message: `Dependency ${dependency.packId}@${dependency.packVersion} is not runtime eligible`,
          context: {
            dependencyKey: key,
            dependencyHash: dependency.packContentHash,
          },
        });
      }
    }
  }

  if (reasons.length > 0) {
    return ineligible(reasons);
  }

  return eligible(packVersion, certification, context);
}
