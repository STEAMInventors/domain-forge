import {
  asArtifactId,
  asStageAttemptId,
  asStageExecutionId,
  checkBudget,
  hasStage0Approval,
  hashObject,
  recordModelUsage,
} from '@domain-forge/core';
import type {
  ForgeStageDefinition,
  ForgeStageExecution,
  ForgeArtifact,
  StageAttempt,
  StageExecutionOutcome,
  StageProposedOutput,
  ImmutableConfigRef,
} from '@domain-forge/contracts';
import { getStageExecutionRequirements, stageFailure } from '@domain-forge/contracts';
import type { ModelPolicyRegistry } from '@domain-forge/models';
import type { ModelProvider } from '@domain-forge/contracts';
import type { PromptRegistry } from './prompt-registry.js';
import type { ForgeRepositories } from '@domain-forge/persistence';
import type { ForgeRun } from '@domain-forge/contracts';
import { buildStageExecutionContext } from './stage-context.js';
import { runStageAcceptanceBoundary, type StageOutputValidator } from './stage-acceptance.js';
import { invokeModelWithMetadata } from './model-invocation.js';
import { deepFreeze } from './immutability.js';

export interface StageRuntimeDeps {
  repos: ForgeRepositories;
  promptRegistry: PromptRegistry;
  modelProvider: ModelProvider;
  policyRegistry: ModelPolicyRegistry;
}

export interface ExecuteStageInput {
  run: ForgeRun;
  definition: ForgeStageDefinition;
  artifacts: Readonly<Record<string, unknown>>;
  packContentHash?: string;
  outputValidators?: readonly StageOutputValidator[];
}

function buildAttemptBase(
  context: ReturnType<typeof buildStageExecutionContext>['context'],
  definition: ForgeStageDefinition,
  attemptNumber: number,
  promptMeta: { id: string; version: string; contentHash: string },
  renderedInputHash: string,
): StageAttempt {
  return {
    id: asStageAttemptId(
      `attempt-${context.forgeRunId}-${definition.stageId}-${attemptNumber}`,
    ),
    attemptNumber,
    projectedInput: { ...context.projectedInput },
    projectedInputHash: context.projectedInputHash,
    promptTemplateId: promptMeta.id,
    promptVersion: promptMeta.version,
    promptFileHash: promptMeta.contentHash,
    renderedInputHash,
    provider: '',
    modelIdentifier: '',
    rawResponse: '',
    validationResults: [],
    evidenceReferences: [],
    toolInvocations: [],
    tokenUsage: { input: 0, output: 0, total: 0 },
    startedAt: context.initiatedAt,
    status: 'RUNNING',
  };
}

function materializeArtifact(
  context: ReturnType<typeof buildStageExecutionContext>['context'],
  definition: ForgeStageDefinition,
  accepted: { content: unknown; contentHash: string },
): ForgeArtifact {
  return {
    id: asArtifactId(`art-${context.forgeRunId}-${definition.stageId}`),
    forgeRunId: context.forgeRunId,
    stageId: definition.stageId,
    artifactType: definition.artifactsProduced[0] ?? 'stage-output',
    schemaVersion: definition.outputSchemaId,
    content: accepted.content,
    contentHash: accepted.contentHash,
    createdAt: new Date().toISOString(),
    immutable: true,
  };
}

export async function executeStage(
  deps: StageRuntimeDeps,
  input: ExecuteStageInput,
): Promise<StageExecutionOutcome> {
  const requirements = getStageExecutionRequirements(input.definition);
  let contextBundle: ReturnType<typeof buildStageExecutionContext>;

  try {
    const configRefs: ImmutableConfigRef[] = [
      {
        refType: 'model-policy',
        id: input.definition.modelPolicy,
        version: input.definition.version,
        contentHash: hashObject({ policy: input.definition.modelPolicy }),
      },
      {
        refType: 'prompt',
        id: input.definition.promptTemplateId,
        version: input.definition.promptVersion,
        contentHash: hashObject({
          promptTemplateId: input.definition.promptTemplateId,
          promptVersion: input.definition.promptVersion,
        }),
      },
    ];

    contextBundle = buildStageExecutionContext({
      run: input.run,
      definition: input.definition,
      artifacts: input.artifacts,
      ...(input.packContentHash !== undefined ? { packContentHash: input.packContentHash } : {}),
      configRefs,
    });
  } catch (error) {
    const partialContext = deepFreeze({
      forgeRunId: input.run.id,
      packId: input.run.packId,
      packVersionId: input.run.packVersionId,
      stageIdentity: {
        stageId: input.definition.stageId,
        definitionVersion: input.definition.version,
      },
      projectedInput: {},
      projectedInputHash: hashObject({}),
      dependencyArtifacts: [],
      configRefs: [],
      initiatedAt: new Date().toISOString(),
      ...(input.packContentHash !== undefined ? { packContentHash: input.packContentHash } : {}),
    });

    return {
      kind: 'INVALID_INPUT',
      context: partialContext,
      failure: stageFailure(
        'STAGE_PROJECTION_ERROR',
        error instanceof Error ? error.message : 'Invalid stage input projection',
      ),
    };
  }

  const { context } = contextBundle;

  if (requirements.requiresStage0ApprovalUnlessSelf) {
    const reviews = await deps.repos.humanReviews.listByRun(input.run.id);
    if (!hasStage0Approval(reviews)) {
      return {
        kind: 'BLOCKED',
        context,
        failure: stageFailure(
          'HUMAN_GATE_REQUIRED',
          'Stage 0 human approval required before stage execution',
          { details: { stageId: input.definition.stageId } },
        ),
      };
    }
  }

  for (const requiredType of input.definition.inputArtifactTypes) {
    if (!(requiredType in input.artifacts)) {
      return {
        kind: 'BLOCKED',
        context,
        failure: stageFailure('BLOCKED_PREREQUISITE', `Missing required artifact: ${requiredType}`, {
          details: { artifactType: requiredType },
        }),
      };
    }
  }

  const promptTemplate = deps.promptRegistry.get(
    input.definition.promptTemplateId,
    input.definition.promptVersion,
  );
  const { rendered, renderedInputHash } = deps.promptRegistry.render(promptTemplate, {
    input: JSON.stringify(context.projectedInput),
  });

  const policy = deps.policyRegistry.resolve(input.definition.modelPolicy);
  const attemptNumber = 1;
  const attempt = buildAttemptBase(
    context,
    input.definition,
    attemptNumber,
    {
      id: promptTemplate.id,
      version: promptTemplate.version,
      contentHash: promptTemplate.contentHash,
    },
    renderedInputHash,
  );

  const modelOutcome = await invokeModelWithMetadata(
    deps.modelProvider,
    { prompt: rendered, jsonSchema: { type: 'object' } },
    policy,
  );

  if (modelOutcome.kind === 'FAILED') {
    attempt.status = 'FAILED';
    attempt.completedAt = new Date().toISOString();
    attempt.failure = {
      code: modelOutcome.failure.code,
      message: modelOutcome.failure.message,
    };

    const execution: ForgeStageExecution = {
      id: asStageExecutionId(`exec-${context.forgeRunId}-${input.definition.stageId}`),
      forgeRunId: context.forgeRunId,
      stageId: input.definition.stageId,
      stageDefinitionVersion: input.definition.version,
      attempts: [attempt],
      status: 'FAILED',
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    };
    await deps.repos.stageExecutions.save(execution);

    return {
      kind: 'RUNTIME_FAILED',
      context,
      failure: stageFailure(modelOutcome.failure.code, modelOutcome.failure.message, {
        retryable: modelOutcome.failure.retryable,
        ...(modelOutcome.failure.details !== undefined
          ? { details: modelOutcome.failure.details }
          : {}),
      }),
      attempt,
      execution,
    };
  }

  const { response, metadata } = modelOutcome;
  attempt.provider = response.provider;
  attempt.modelIdentifier = response.modelIdentifier;
  attempt.rawResponse = response.rawText;
  attempt.tokenUsage = response.tokenUsage;
  attempt.completedAt = new Date().toISOString();
  if (response.modelVersion !== undefined) attempt.modelVersion = response.modelVersion;
  if (response.costUsd !== undefined) attempt.costUsd = response.costUsd;
  if (response.parsedJson !== undefined) attempt.parsedOutput = response.parsedJson;

  const usageInput: { input: number; output: number; costUsd?: number } = {
    input: response.tokenUsage.input,
    output: response.tokenUsage.output,
  };
  if (response.costUsd !== undefined) usageInput.costUsd = response.costUsd;

  try {
    const usage = recordModelUsage(input.run.budgetUsage, usageInput);
    checkBudget(input.run.budget, usage);
    await deps.repos.budgetUsage.save(input.run.id, usage);
  } catch (error) {
    attempt.status = 'FAILED';
    attempt.failure = {
      code: 'BUDGET_EXCEEDED',
      message: error instanceof Error ? error.message : 'Budget exceeded',
    };

    const execution: ForgeStageExecution = {
      id: asStageExecutionId(`exec-${context.forgeRunId}-${input.definition.stageId}`),
      forgeRunId: context.forgeRunId,
      stageId: input.definition.stageId,
      stageDefinitionVersion: input.definition.version,
      attempts: [attempt],
      status: 'FAILED',
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    };
    await deps.repos.stageExecutions.save(execution);

    return {
      kind: 'RUNTIME_FAILED',
      context,
      failure: stageFailure('BUDGET_EXCEEDED', attempt.failure.message, { retryable: false }),
      attempt,
      execution,
    };
  }

  const proposed: StageProposedOutput = {
    source: 'MODEL',
    rawText: response.rawText,
    parsed: response.parsedJson,
    modelExecution: metadata,
    rawResponseHash: metadata.responseHash,
  };

  const validators = input.outputValidators ?? [];
  const acceptance = runStageAcceptanceBoundary(proposed, validators, attemptNumber);
  attempt.validationResults = acceptance.status === 'ACCEPTED' ? acceptance.accepted.validationResults : acceptance.validationResults;

  const execution: ForgeStageExecution = {
    id: asStageExecutionId(`exec-${context.forgeRunId}-${input.definition.stageId}`),
    forgeRunId: context.forgeRunId,
    stageId: input.definition.stageId,
    stageDefinitionVersion: input.definition.version,
    attempts: [attempt],
    status: 'RUNNING',
    startedAt: attempt.startedAt,
  };

  if (acceptance.status === 'ACCEPTED') {
    attempt.status = 'COMPLETED';
    execution.status = 'COMPLETED';
    execution.completedAt = attempt.completedAt;

    const artifact = materializeArtifact(context, input.definition, acceptance.accepted);
    execution.outputArtifactId = artifact.id;
    await deps.repos.stageExecutions.save(execution);
    await deps.repos.artifacts.save(artifact);

    return {
      kind: 'SUCCEEDED',
      context,
      execution,
      attempt,
      proposed: acceptance.proposed,
      accepted: acceptance.accepted,
      artifact,
    };
  }

  if (acceptance.status === 'NEEDS_REVIEW') {
    attempt.status = 'NEEDS_REVIEW';
    execution.status = 'NEEDS_REVIEW';
    execution.completedAt = attempt.completedAt;
    await deps.repos.stageExecutions.save(execution);

    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      context,
      execution,
      attempt,
      proposed: acceptance.proposed,
      reviewReason: acceptance.reviewReason,
      validationResults: acceptance.validationResults,
    };
  }

  attempt.status = 'FAILED';
  attempt.failure = {
    code: acceptance.failure.code,
    message: acceptance.failure.message,
  };
  execution.status = 'FAILED';
  execution.completedAt = attempt.completedAt;
  await deps.repos.stageExecutions.save(execution);

  return {
    kind: 'VALIDATION_FAILED',
    context,
    execution,
    attempt,
    proposed: acceptance.proposed,
    failure: acceptance.failure,
    validationResults: acceptance.validationResults,
  };
}

export function getModelIdentityFromAttempt(attempt: StageAttempt): string {
  return `${attempt.provider}:${attempt.modelIdentifier}${attempt.modelVersion ? `@${attempt.modelVersion}` : ''}`;
}
