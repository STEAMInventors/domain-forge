import type {
  PackCapabilityRequirement,
  RuntimeCapability,
  RuntimeEligibilityReason,
} from '@domain-forge/contracts';
import type { CapabilityRequirementEntry } from '@hive/pack-contract';

function parseVersionParts(version: string): number[] {
  return version.split('.').map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });
}

/** Deterministic version comparison — supplied >= required minVersion. */
export function satisfiesMinVersion(supplied: string, requiredMin: string): boolean {
  const suppliedParts = parseVersionParts(supplied);
  const requiredParts = parseVersionParts(requiredMin);
  const length = Math.max(suppliedParts.length, requiredParts.length);

  for (let i = 0; i < length; i += 1) {
    const suppliedPart = suppliedParts[i] ?? 0;
    const requiredPart = requiredParts[i] ?? 0;
    if (suppliedPart > requiredPart) return true;
    if (suppliedPart < requiredPart) return false;
  }

  return true;
}

export function toPackCapabilityRequirements(
  entries: readonly CapabilityRequirementEntry[],
): readonly PackCapabilityRequirement[] {
  return entries.map((entry) => ({
    id: entry.id,
    capabilityId: entry.capabilityId,
    minVersion: entry.minVersion,
    ...(entry.feature !== undefined ? { feature: entry.feature } : {}),
  }));
}

export function evaluateCapabilityRequirements(
  requirements: readonly PackCapabilityRequirement[],
  supplied: readonly RuntimeCapability[],
): readonly RuntimeEligibilityReason[] {
  const reasons: RuntimeEligibilityReason[] = [];

  for (const requirement of requirements) {
    const match = supplied.find((cap) => cap.capabilityId === requirement.capabilityId);
    if (match === undefined) {
      reasons.push({
        code: 'RUNTIME_CAPABILITY_MISSING',
        message: `Required capability ${requirement.capabilityId} is not supplied`,
        context: { requirementId: requirement.id, capabilityId: requirement.capabilityId },
      });
      continue;
    }

    if (!satisfiesMinVersion(match.version, requirement.minVersion)) {
      reasons.push({
        code: 'RUNTIME_CAPABILITY_MISSING',
        message: `Capability ${requirement.capabilityId} version ${match.version} is below required minVersion ${requirement.minVersion}`,
        context: {
          requirementId: requirement.id,
          capabilityId: requirement.capabilityId,
          suppliedVersion: match.version,
          minVersion: requirement.minVersion,
        },
      });
    }
  }

  return reasons;
}
