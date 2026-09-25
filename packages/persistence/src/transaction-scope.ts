import { certificationAtomicityFailure, transactionConflict } from './persistence-errors.js';

export interface TransactionSnapshot {
  restore(): void;
}

export class InMemoryTransactionScope {
  private readonly snapshots: TransactionSnapshot[] = [];
  private committed = false;

  track(snapshot: TransactionSnapshot): void {
    if (this.committed) {
      throw transactionConflict('Transaction already committed');
    }
    this.snapshots.push(snapshot);
  }

  commit(): void {
    this.committed = true;
    this.snapshots.length = 0;
  }

  rollback(): void {
    for (let i = this.snapshots.length - 1; i >= 0; i -= 1) {
      this.snapshots[i]!.restore();
    }
    this.snapshots.length = 0;
  }
}

export async function runAtomic<T>(
  scope: InMemoryTransactionScope,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const result = await operation();
    scope.commit();
    return result;
  } catch (error) {
    scope.rollback();
    throw error;
  }
}

export async function runCertificationAtomic<T>(
  scope: InMemoryTransactionScope,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await runAtomic(scope, operation);
  } catch (error) {
    if (error instanceof Error && error.name === 'PersistenceError') {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Certification atomic persistence failed';
    throw certificationAtomicityFailure(message, {
      cause: error instanceof Error ? error.name : undefined,
    });
  }
}
