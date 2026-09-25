#!/usr/bin/env node
import { join } from 'node:path';
import { JsonFilePersistence } from '@domain-forge/persistence';
import { ForgeOrchestrator, PromptRegistry, executeStage } from '@domain-forge/orchestration';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import { createPackVersion, evaluateProvisionalTransition, applyPackVersionTransition } from '@domain-forge/packs';
import { certifyProvisionalPack } from '@domain-forge/certification';
import { createMinimalTestPack } from '@domain-forge/testing';
import { computePackContentHash } from '@hive/pack-contract';
import type { ForgeRunId, PackVersionId, HumanGateType } from '@domain-forge/core';
import defaultBudget from '../../../configs/budgets/default.json' with { type: 'json' };

const DATA_DIR = join(process.cwd(), '.data');

async function getRepos() {
  const persistence = new JsonFilePersistence({ baseDir: DATA_DIR });
  await persistence.init();
  return persistence;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'create-run':
      await cmdCreateRun(args);
      break;
    case 'inspect-run':
      await cmdInspectRun(args[0]);
      break;
    case 'execute-stage':
      await cmdExecuteStage(args[0]);
      break;
    case 'resume-run':
      await cmdResumeRun(args[0]);
      break;
    case 'record-gate':
      await cmdRecordGate(args);
      break;
    case 'inspect-pack':
      await cmdInspectPack(args[0]);
      break;
    case 'certify':
      await cmdCertify(args);
      break;
    case 'provenance':
      await cmdProvenance(args[0]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`Domain Forge CLI

Commands:
  create-run <domainId> <packId> <packVersion>   Create a new ForgeRun
  inspect-run <runId>                           Inspect run state
  execute-stage <runId>                         Execute eligible example stage
  resume-run <runId>                            Resume a blocked/waiting run
  record-gate <runId> <gateType> <reviewerId>   Record human gate approval
  inspect-pack <packVersionId>                  Inspect pack candidate
  certify <packVersionId> <reviewerId> <role>   Certify provisional pack
  provenance <packVersionId>                    Show provenance summary
`);
}

async function cmdCreateRun(args: string[]): Promise<void> {
  const [domainId, packId, packVersion] = args;
  if (!domainId || !packId || !packVersion) {
    console.error('Usage: create-run <domainId> <packId> <packVersion>');
    process.exit(1);
  }

  const persistence = await getRepos();
  const orchestrator = new ForgeOrchestrator(persistence.repositories);
  const run = await orchestrator.createRun({
    domainId,
    packId,
    packVersion,
    budget: defaultBudget,
  });

  const pack = createMinimalTestPack({ packId, packVersion, domainId });
  const packVer = createPackVersion(packId, packVersion, pack);
  await persistence.persistPackVersion(packVer);
  await persistence.persistForgeRun(run);

  console.log(JSON.stringify({ runId: run.id, packVersionId: packVer.id, state: run.state }, null, 2));
}

async function cmdInspectRun(runId: string | undefined): Promise<void> {
  if (!runId) {
    console.error('Usage: inspect-run <runId>');
    process.exit(1);
  }
  const persistence = await getRepos();
  const run = await persistence.repositories.forgeRuns.get(runId as ForgeRunId);
  if (!run) {
    console.error('Run not found');
    process.exit(1);
  }
  const executions = await persistence.repositories.stageExecutions.listByRun(run.id);
  const reviews = await persistence.repositories.humanReviews.listByRun(run.id);
  console.log(JSON.stringify({ run, executions, reviews }, null, 2));
}

async function cmdExecuteStage(runId: string | undefined): Promise<void> {
  if (!runId) {
    console.error('Usage: execute-stage <runId>');
    process.exit(1);
  }

  const persistence = await getRepos();
  const repos = persistence.repositories;
  const orchestrator = new ForgeOrchestrator(repos);

  let run = await repos.forgeRuns.get(runId as ForgeRunId);
  if (!run) {
    console.error('Run not found');
    process.exit(1);
  }

  if (run.state === 'CREATED') {
    run = await orchestrator.startRun(run.id);
  }

  const promptRegistry = new PromptRegistry();
  await promptRegistry.loadFromDirectory(
    join(process.cwd(), 'prompts', 'example-neutral'),
    'example-neutral',
    '0.1.0',
    'template.md',
  );

  const modelProvider = new FakeModelProvider('fake', {
    default: JSON.stringify({
      schemaVersion: '0.1.0',
      observation: 'Neutral metric within expected range.',
      metricValue: 42,
      tags: ['synthetic', 'test'],
    }),
  });

  const policyRegistry = createDefaultPolicyRegistry();

  const artifacts = {
    'seed-input': {
      content: { seedValue: 10, label: 'test-seed' },
    },
  };

  const { execution, artifact } = await executeStage(
    { repos, promptRegistry, modelProvider, policyRegistry },
    {
      run,
      definition: EXAMPLE_STAGE_DEFINITION,
      artifacts,
      outputValidator: validateExampleStageOutput,
    },
  );

  console.log(JSON.stringify({ execution, artifact }, null, 2));
}

async function cmdResumeRun(runId: string | undefined): Promise<void> {
  if (!runId) {
    console.error('Usage: resume-run <runId>');
    process.exit(1);
  }
  const persistence = await getRepos();
  const orchestrator = new ForgeOrchestrator(persistence.repositories);
  const run = await orchestrator.resumeRun(runId as ForgeRunId);
  console.log(JSON.stringify(run, null, 2));
}

async function cmdRecordGate(args: string[]): Promise<void> {
  const [runId, gateType, reviewerId] = args;
  if (!runId || !gateType || !reviewerId) {
    console.error('Usage: record-gate <runId> <gateType> <reviewerId>');
    process.exit(1);
  }

  const persistence = await getRepos();
  const orchestrator = new ForgeOrchestrator(persistence.repositories);
  const record = await orchestrator.recordHumanGate({
    forgeRunId: runId as ForgeRunId,
    gateType: gateType as HumanGateType,
    reviewerId,
    reviewerRole: 'architect',
    decision: 'APPROVED',
    notes: 'CLI-recorded approval',
  });
  await persistence.persistHumanReview(record);
  console.log(JSON.stringify(record, null, 2));
}

async function cmdInspectPack(packVersionId: string | undefined): Promise<void> {
  if (!packVersionId) {
    console.error('Usage: inspect-pack <packVersionId>');
    process.exit(1);
  }
  const persistence = await getRepos();
  const pack = await persistence.repositories.packVersions.get(
    packVersionId as PackVersionId,
  );
  if (!pack) {
    console.error('Pack version not found');
    process.exit(1);
  }
  console.log(JSON.stringify(pack, null, 2));
}

async function cmdCertify(args: string[]): Promise<void> {
  const [packVersionId, reviewerId, reviewerRole] = args;
  if (!packVersionId || !reviewerId || !reviewerRole) {
    console.error('Usage: certify <packVersionId> <reviewerId> <role>');
    process.exit(1);
  }

  const persistence = await getRepos();
  let pack = await persistence.repositories.packVersions.get(
    packVersionId as PackVersionId,
  );
  if (!pack) {
    console.error('Pack version not found');
    process.exit(1);
  }

  if (pack.state === 'DRAFT') {
    const readiness = {
      stage0Approved: true,
      allStagesCompleted: true,
      schemaValid: true,
      semanticValid: true,
      evidenceValid: true,
      quotesVerified: true,
      referencesResolved: true,
      primitivesValid: true,
      structuresValid: true,
      noOpenGaps: true,
      adversarialClear: true,
      fixturesExist: true,
      fixturesMatch: true,
      fixtureCoverageMet: true,
      budgetOk: true,
      noBlockingHumanReview: true,
      packContentHashFrozen: true,
    };
    const evalResult = evaluateProvisionalTransition(pack, readiness);
    if (evalResult.canTransition) {
      pack = applyPackVersionTransition(pack, 'PROVISIONAL');
      await persistence.persistPackVersion(pack);
    }
  }

  const { certification, packVersion } = certifyProvisionalPack({
    packVersion: pack,
    reviewerId,
    reviewerRole,
  });

  await persistence.persistCertification(certification);
  await persistence.persistPackVersion(packVersion);
  console.log(JSON.stringify({ certification, packVersion }, null, 2));
}

async function cmdProvenance(packVersionId: string | undefined): Promise<void> {
  if (!packVersionId) {
    console.error('Usage: provenance <packVersionId>');
    process.exit(1);
  }
  const persistence = await getRepos();
  const pack = await persistence.repositories.packVersions.get(
    packVersionId as PackVersionId,
  );
  if (!pack) {
    console.error('Pack version not found');
    process.exit(1);
  }

  const certs = await persistence.repositories.certifications.listByPack(pack.packId);
  const hash = computePackContentHash(pack.packContent);

  console.log(
    JSON.stringify(
      {
        packId: pack.packId,
        packVersion: pack.version,
        packContentHash: hash,
        corpusHash: pack.corpusHash,
        state: pack.state,
        certifications: certs,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
