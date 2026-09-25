import type { DomainPackV0 } from '@hive/pack-contract';
import type { PackId, PackVersionId } from '@domain-forge/core';
import type { PackVersionState } from '@domain-forge/core';

export interface DomainPackCandidate {
  pack: DomainPackV0;
  packContentHash: string;
}

export interface PackVersion {
  id: PackVersionId;
  packId: PackId;
  version: string;
  state: PackVersionState;
  packContent: DomainPackV0;
  packContentHash: string;
  corpusHash: string;
  createdAt: string;
  updatedAt: string;
  frozenAt?: string;
}
