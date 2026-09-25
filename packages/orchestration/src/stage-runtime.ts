import {
  asArtifactId,
  asStageAttemptId,
  asStageExecutionId,
  checkBudget,
  hasStage0Approval,
  hashObject,
  HumanGateRequiredError,
  recordModelUsage,
} from '@domain-forge/core';
import type {
  ForgeStageDefinition,
  ForgeStageExecution,
  ForgeArtifact,
  StageAttempt,
  ValidationResult,
} from '@domain-forge/contracts';
import type { ModelProvider } from '@domain-forge/contracts';
import type { ModelPolicyRegistry } from '@domain-forge/models';
import { projectStageInput } from '@domain-forge/validation';
import type { PromptRegistry } from './prompt-registry.js';
import type { ForgeRepositories } from '@domain-forge/persistence';
import type { ForgeRun } from '@domain-forge/contracts';

export interface StageRuntimeDeps {
  repos: ForgeRepositories;
  promptRegistry: PromptRegistry;
  modelProvider: ModelProvider;
  policyRegistry: ModelPolicyRegistry;
}

export interface ExecuteStageInput {
  run: ForgeRun;
  definition: ForgeStageDefinition;
  artifacts: Record<string, unknown>;
  outputValidator?: (output: unknown) => ValidationResult;
}

export async function executeStage(
  deps: StageRuntimeDeps,
  input: ExecuteStageInput,
): Promise<{ execution: ForgeStageExecution; artifact?: ForgeArtifact }> {
  if (input.definition.stageId !== 'stage-0') {
    const reviews = await deps.repos.humanReviews.listByRun(input.run.id);
    if (!hasStage0Approval(reviews)) {
      throw new HumanGateRequiredError('Stage 0 human approval required before stage execution');
    }
  }

  const { projected, projectedInputHash } = projectStageInput(input.definition, input.artifacts);

  const promptTemplate = deps.promptRegistry.get(
    input.definition.promptTemplateId,
    input.definition.promptVersion,
  );
  const { rendered, renderedInputHash } = deps.promptRegistry.render(promptTemplate, {
    input: JSON.stringify(projected),
  });

  const policy = deps.policyRegistry.resolve(input.definition.modelPolicy);

  const modelResponse = await deps.modelProvider.invoke(
    { prompt: rendered, jsonSchema: { type: 'object' } },
    policy,
  );

  const usageInput: { input: number; output: number; costUsd?: number } = {
    input: modelResponse.tokenUsage.input,
    output: modelResponse.tokenUsage.output,
  };
  if (modelResponse.costUsd !== undefined) usageInput.costUsd = modelResponse.costUsd;
  const usage = recordModelUsage(input.run.budgetUsage, usageInput);
  checkBudget(input.run.budget, usage);
  await deps.repos.budgetUsage.save(input.run.id, usage);

  const attemptNumber = 1;
  const attempt: StageAttempt = {
    id: asStageAttemptId(`attempt-${input.run.id}-${input.definition.stageId}-${attemptNumber}`),
    attemptNumber,
    projectedInput: projected,
    projectedInputHash,
    promptTemplateId: promptTemplate.id,
    promptVersion: promptTemplate.version,
    promptFileHash: promptTemplate.contentHash,
    renderedInputHash,
    provider: modelResponse.provider,
    modelIdentifier: modelResponse.modelIdentifier,
    rawResponse: modelResponse.rawText,
    validationResults: [],
    evidenceReferences: [],
    toolInvocations: [],
    tokenUsage: modelResponse.tokenUsage,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'COMPLETED',
  };
  if (modelResponse.modelVersion !== undefined) attempt.modelVersion = modelResponse.modelVersion;
  if (modelResponse.parsedJson !== undefined) attempt.parsedOutput = modelResponse.parsedJson;
  if (modelResponse.costUsd !== undefined) attempt.costUsd = modelResponse.costUsd;

  if (input.outputValidator && modelResponse.parsedJson !== undefined) {
    const validationResult = input.outputValidator(modelResponse.parsedJson);
    attempt.validationResults = [validationResult];
    if (!validationResult.passed) {
      attempt.status = 'FAILED';
      attempt.failure = {
        code: 'FAILED_VALIDATION',
        message: validationResult.errors.map((e) => e.message).join('; '),
      };
    }
  }

  const execution: ForgeStageExecution = {
    id: asStageExecutionId(`exec-${input.run.id}-${input.definition.stageId}`),
    forgeRunId: input.run.id,
    stageId: input.definition.stageId,
    stageDefinitionVersion: input.definition.version,
    attempts: [attempt],
    status: attempt.status,
    startedAt: attempt.startedAt,
  };
  if (attempt.completedAt !== undefined) execution.completedAt = attempt.completedAt;

  await deps.repos.stageExecutions.save(execution);

  let artifact: ForgeArtifact | undefined;
  if (attempt.status === 'COMPLETED' && modelResponse.parsedJson !== undefined) {
    const contentHash = hashObject(modelResponse.parsedJson);
    artifact = {
      id: asArtifactId(`art-${input.run.id}-${input.definition.stageId}`),
      forgeRunId: input.run.id,
      stageId: input.definition.stageId,
      artifactType: input.definition.artifactsProduced[0] ?? 'stage-output',
      schemaVersion: '0.1.0',
      content: modelResponse.parsedJson,
      contentHash,
      createdAt: new Date().toISOString(),
      immutable: true,
    };
    execution.outputArtifactId = artifact.id;
    await deps.repos.artifacts.save(artifact);
  }

  if (artifact !== undefined) {
    return { execution, artifact };
  }
  return { execution };
}

export function getModelIdentityFromAttempt(attempt: StageAttempt): string {
  return `${attempt.provider}:${attempt.modelIdentifier}${attempt.modelVersion ? `@${attempt.modelVersion}` : ''}`;
}
