import { asArtifactId, hashObject } from '@domain-forge/core';
import type { ForgeArtifact } from '@domain-forge/contracts';
import { ForgeOrchestrator } from '@domain-forge/orchestration';
import type { CliContext, CommandResult } from '../types.js';
import { ExitCode } from '../exit-codes.js';
import defaultBudget from '../../../../configs/budgets/default.json' with { type: 'json' };

const INITIAL_PACK_VERSION = '0.1.0';

function normalizeDomainId(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    throw new Error('Domain name must contain at least one letter or number');
  }

  return normalized.slice(0, 96);
}

export async function cmdForge(
  ctx: CliContext,
  args: readonly string[],
): Promise<CommandResult> {
  const domainLabel = args.join(' ').trim();
  if (!domainLabel) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Usage: forge <domainName>',
      errors: [{ code: 'USAGE_ERROR', message: 'Missing domain name' }],
    };
  }

  let domainId: string;
  try {
    domainId = normalizeDomainId(domainLabel);
  } catch (error) {
    return {
      exitCode: ExitCode.USAGE_OR_CONFIG,
      summary: 'Invalid domain name',
      errors: [
        {
          code: 'INVALID_DOMAIN_NAME',
          message: error instanceof Error ? error.message : 'Invalid domain name',
        },
      ],
    };
  }

  const packId = `pack-${domainId}`;
  const orchestrator = new ForgeOrchestrator(ctx.repos);
  const run = await orchestrator.createRun({
    domainId,
    packId,
    packVersion: INITIAL_PACK_VERSION,
    budget: defaultBudget,
  });

  const intent = {
    domainId,
    domainLabel,
    scopeDescription:
      `Domain Forge discovery requested for "${domainLabel}". No narrower scope has been supplied.`,
    jurisdiction: 'UNDETERMINED',
  };

  const intentArtifact: ForgeArtifact = {
    id: asArtifactId(`art-${run.id}-domain-intent`),
    forgeRunId: run.id,
    stageId: 'intake',
    artifactType: 'domain-intent',
    schemaVersion: 'domain-intent@0.1.0',
    content: intent,
    contentHash: hashObject(intent),
    createdAt: new Date().toISOString(),
    immutable: true,
  };
  await ctx.repos.artifacts.append(intentArtifact);

  return {
    exitCode: ExitCode.SUCCESS,
    summary: `Forge run created for ${domainLabel}`,
    payload: {
      domain: domainLabel,
      domainId,
      runId: run.id,
      runState: run.state,
      targetPackId: packId,
      targetPackVersion: INITIAL_PACK_VERSION,
      dataDir: ctx.dataDir,
      createdArtifact: {
        artifactType: intentArtifact.artifactType,
        artifactId: intentArtifact.id,
        contentHash: intentArtifact.contentHash,
      },
      packCreated: false,
      nextStage: 'stage-0',
      nextRequirement:
        'Execute evidence-backed Stage 0 Legality & Service Boundary before materializing a Domain Pack.',
    },
  };
}
