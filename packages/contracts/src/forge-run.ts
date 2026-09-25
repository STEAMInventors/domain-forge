import type { RunBudget, BudgetUsage } from '@domain-forge/core';
import type { ForgeRunId, PackId, PackVersionId } from '@domain-forge/core';
import type { ForgeRunState } from '@domain-forge/core';

export interface ForgeRun {
  id: ForgeRunId;
  packId: PackId;
  packVersionId: PackVersionId;
  domainId: string;
  state: ForgeRunState;
  budget: RunBudget;
  budgetUsage: BudgetUsage;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
