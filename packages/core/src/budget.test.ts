import { describe, it, expect } from 'vitest';
import { checkBudget, recordModelUsage, emptyBudgetUsage } from './budget.js';
import { BudgetExceededError } from './errors.js';

describe('budget enforcement', () => {
  const budget = {
    maxModelInvocations: 2,
    maxInputTokens: 100,
    maxOutputTokens: 100,
    maxTotalTokens: 200,
    maxRetryAttempts: 1,
    maxRuleReviewRounds: 1,
  };

  it('passes within budget', () => {
    expect(() => checkBudget(budget, emptyBudgetUsage())).not.toThrow();
  });

  it('throws when model invocations exceeded', () => {
    const usage = { ...emptyBudgetUsage(), modelInvocations: 3 };
    expect(() => checkBudget(budget, usage)).toThrow(BudgetExceededError);
  });

  it('records model usage', () => {
    const usage = recordModelUsage(emptyBudgetUsage(), { input: 10, output: 20 });
    expect(usage.modelInvocations).toBe(1);
    expect(usage.totalTokens).toBe(30);
  });
});
