import type { ForgeRunId, PackId, PackVersionId } from '../ids.js';
import type { ForgeRunState, ForgeRunTransitionAction } from './forge-run.js';
import type { PackVersionState, PackVersionTransitionAction } from './pack-version.js';

export interface PackVersionTransitionContext {
  actorRef?: string;
  reasonRef?: string;
}

export interface PackVersionTransitionRecord {
  packVersionId: PackVersionId;
  packId: PackId;
  version: string;
  packContentHash: string;
  fromState: PackVersionState;
  toState: PackVersionState;
  action: PackVersionTransitionAction;
  actorRef?: string;
  reasonRef?: string;
}

export interface ForgeRunTransitionContext {
  actorRef?: string;
  reasonRef?: string;
}

export interface ForgeRunTransitionRecord {
  forgeRunId: ForgeRunId;
  packVersionId: PackVersionId;
  packId: PackId;
  fromState: ForgeRunState;
  toState: ForgeRunState;
  action: ForgeRunTransitionAction;
  actorRef?: string;
  reasonRef?: string;
}

export function createPackVersionTransitionRecord(
  identity: {
    packVersionId: PackVersionId;
    packId: PackId;
    version: string;
    packContentHash: string;
  },
  transition: {
    fromState: PackVersionState;
    toState: PackVersionState;
    action: PackVersionTransitionAction;
  },
  context?: PackVersionTransitionContext,
): PackVersionTransitionRecord {
  const record: PackVersionTransitionRecord = {
    packVersionId: identity.packVersionId,
    packId: identity.packId,
    version: identity.version,
    packContentHash: identity.packContentHash,
    fromState: transition.fromState,
    toState: transition.toState,
    action: transition.action,
  };
  if (context?.actorRef !== undefined) record.actorRef = context.actorRef;
  if (context?.reasonRef !== undefined) record.reasonRef = context.reasonRef;
  return record;
}

export function createForgeRunTransitionRecord(
  identity: {
    forgeRunId: ForgeRunId;
    packVersionId: PackVersionId;
    packId: PackId;
  },
  transition: {
    fromState: ForgeRunState;
    toState: ForgeRunState;
    action: ForgeRunTransitionAction;
  },
  context?: ForgeRunTransitionContext,
): ForgeRunTransitionRecord {
  const record: ForgeRunTransitionRecord = {
    forgeRunId: identity.forgeRunId,
    packVersionId: identity.packVersionId,
    packId: identity.packId,
    fromState: transition.fromState,
    toState: transition.toState,
    action: transition.action,
  };
  if (context?.actorRef !== undefined) record.actorRef = context.actorRef;
  if (context?.reasonRef !== undefined) record.reasonRef = context.reasonRef;
  return record;
}
