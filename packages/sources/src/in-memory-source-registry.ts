import type { SourceId } from '@domain-forge/core';
import type { SourceRecord, SourceRegistry } from '@domain-forge/contracts';

export function createInMemorySourceRegistry(initial: readonly SourceRecord[] = []): SourceRegistry {
  const byId = new Map<string, SourceRecord>();
  const byFingerprint = new Map<string, SourceRecord>();

  for (const record of initial) {
    byId.set(record.identity.sourceId, record);
    byFingerprint.set(record.identity.contentFingerprint.hash, record);
  }

  return {
    async save(record: SourceRecord): Promise<void> {
      byId.set(record.identity.sourceId, record);
      byFingerprint.set(record.identity.contentFingerprint.hash, record);
    },
    async get(sourceId: SourceId): Promise<SourceRecord | undefined> {
      return byId.get(sourceId);
    },
    async getByFingerprint(fingerprint: string): Promise<SourceRecord | undefined> {
      return byFingerprint.get(fingerprint);
    },
  };
}
