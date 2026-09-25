import { join } from 'node:path';
import { PromptRegistry, executeStage, type StageRuntimeDeps } from '@domain-forge/orchestration';
import { FakeModelProvider, createDefaultPolicyRegistry } from '@domain-forge/models';
import { EXAMPLE_STAGE_DEFINITION, validateExampleStageOutput } from '@domain-forge/stages';
import type { ForgeRepositories } from '@domain-forge/persistence';
import type { ForgeRun, StageExecutionOutcome } from '@domain-forge/contracts';

export const BOOTSTRAP_STAGE_DEFINITION = EXAMPLE_STAGE_DEFINITION;

export async function createBootstrapStageDeps(
  repos: ForgeRepositories,
  rootDir: string,
): Promise<StageRuntimeDeps> {
  const promptRegistry = new PromptRegistry();
  await promptRegistry.loadFromDirectory(
    join(rootDir, 'prompts', 'example-neutral'),
    'example-neutral',
    '0.1.0',
    'template.md',
  );

  return {
    repos,
    promptRegistry,
    modelProvider: new FakeModelProvider('fake', {
      default: JSON.stringify({
        schemaVersion: '0.1.0',
        observation: 'Neutral metric within expected range.',
        metricValue: 42,
        tags: ['synthetic', 'test'],
      }),
    }),
    policyRegistry: createDefaultPolicyRegistry(),
  };
}

export async function executeBootstrapStage(
  deps: StageRuntimeDeps,
  run: ForgeRun,
): Promise<StageExecutionOutcome> {
  return executeStage(deps, {
    run,
    definition: BOOTSTRAP_STAGE_DEFINITION,
    artifacts: {
      'seed-input': {
        content: { seedValue: 10, label: 'worker-seed' },
      },
    },
    outputValidators: [validateExampleStageOutput],
  });
}
