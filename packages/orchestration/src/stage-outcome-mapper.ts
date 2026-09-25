import type { ForgeRunTransitionAction } from '@domain-forge/core';
import type { StageExecutionOutcome } from '@domain-forge/contracts';

/**
 * Maps a stage outcome to a ForgeRun lifecycle action.
 * Lifecycle mutation remains centralized in the orchestrator — stages do not apply transitions.
 */
export function mapStageOutcomeToRunAction(
  outcome: StageExecutionOutcome,
): ForgeRunTransitionAction | null {
  switch (outcome.kind) {
    case 'SUCCEEDED':
      return null;
    case 'HUMAN_REVIEW_REQUIRED':
      return 'AWAIT_HUMAN';
    case 'BLOCKED':
      return outcome.failure.code === 'HUMAN_GATE_REQUIRED' ? 'AWAIT_HUMAN' : 'BLOCK';
    case 'VALIDATION_FAILED':
    case 'RUNTIME_FAILED':
    case 'INVALID_INPUT':
      return 'FAIL';
  }
}

export function isTerminalStageFailure(outcome: StageExecutionOutcome): boolean {
  return (
    outcome.kind === 'VALIDATION_FAILED' ||
    outcome.kind === 'RUNTIME_FAILED' ||
    outcome.kind === 'INVALID_INPUT'
  );
}
