import { BudgetExceededError } from './errors.js';

export interface RunBudget {
  maxModelInvocations: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  maxCostUsd?: number;
  maxRetryAttempts: number;
  maxRuleReviewRounds: number;
}

export interface BudgetUsage {
  modelInvocations: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  retryAttempts: number;
  ruleReviewRounds: number;
}

export function emptyBudgetUsage(): BudgetUsage {
  return {
    modelInvocations: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    retryAttempts: 0,
    ruleReviewRounds: 0,
  };
}

export function checkBudget(budget: RunBudget, usage: BudgetUsage): void {
  if (usage.modelInvocations > budget.maxModelInvocations) {
    throw new BudgetExceededError('Maximum model invocations exceeded', {
      limit: budget.maxModelInvocations,
      actual: usage.modelInvocations,
    });
  }
  if (usage.inputTokens > budget.maxInputTokens) {
    throw new BudgetExceededError('Maximum input tokens exceeded', {
      limit: budget.maxInputTokens,
      actual: usage.inputTokens,
    });
  }
  if (usage.outputTokens > budget.maxOutputTokens) {
    throw new BudgetExceededError('Maximum output tokens exceeded', {
      limit: budget.maxOutputTokens,
      actual: usage.outputTokens,
    });
  }
  if (usage.totalTokens > budget.maxTotalTokens) {
    throw new BudgetExceededError('Maximum total tokens exceeded', {
      limit: budget.maxTotalTokens,
      actual: usage.totalTokens,
    });
  }
  if (budget.maxCostUsd !== undefined && usage.costUsd > budget.maxCostUsd) {
    throw new BudgetExceededError('Maximum cost exceeded', {
      limit: budget.maxCostUsd,
      actual: usage.costUsd,
    });
  }
  if (usage.retryAttempts > budget.maxRetryAttempts) {
    throw new BudgetExceededError('Maximum retry attempts exceeded', {
      limit: budget.maxRetryAttempts,
      actual: usage.retryAttempts,
    });
  }
  if (usage.ruleReviewRounds > budget.maxRuleReviewRounds) {
    throw new BudgetExceededError('Maximum rule review rounds exceeded', {
      limit: budget.maxRuleReviewRounds,
      actual: usage.ruleReviewRounds,
    });
  }
}

export function recordModelUsage(
  usage: BudgetUsage,
  tokens: { input: number; output: number; costUsd?: number },
): BudgetUsage {
  const next: BudgetUsage = {
    ...usage,
    modelInvocations: usage.modelInvocations + 1,
    inputTokens: usage.inputTokens + tokens.input,
    outputTokens: usage.outputTokens + tokens.output,
    totalTokens: usage.totalTokens + tokens.input + tokens.output,
    costUsd: usage.costUsd + (tokens.costUsd ?? 0),
  };
  return next;
}
