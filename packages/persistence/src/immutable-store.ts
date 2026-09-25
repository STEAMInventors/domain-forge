import {
  duplicateImmutableRecord,
  immutableRecordModification,
} from './persistence-errors.js';

export interface ImmutableStoreOptions<T> {
  readonly entity: string;
  readonly getId: (record: T) => string;
  readonly equals?: (a: T, b: T) => boolean;
}

/** Append-only immutable record store with deterministic duplicate handling. */
export class ImmutableStore<T> {
  private readonly map = new Map<string, T>();
  private readonly entity: string;
  private readonly getId: (record: T) => string;
  private readonly equals: (a: T, b: T) => boolean;

  constructor(options: ImmutableStoreOptions<T>) {
    this.entity = options.entity;
    this.getId = options.getId;
    this.equals = options.equals ?? ((a, b) => JSON.stringify(a) === JSON.stringify(b));
  }

  append(record: T): void {
    const id = this.getId(record);
    const existing = this.map.get(id);
    if (existing !== undefined) {
      if (this.equals(existing, record)) {
        return;
      }
      throw duplicateImmutableRecord(this.entity, id);
    }
    this.map.set(id, record);
  }

  get(id: string): T | undefined {
    return this.map.get(id);
  }

  list(): readonly T[] {
    return [...this.map.values()];
  }

  assertUnchanged(id: string, record: T): void {
    const existing = this.map.get(id);
    if (existing !== undefined && !this.equals(existing, record)) {
      throw immutableRecordModification(this.entity, id);
    }
  }

  replace(id: string, record: T, predicate: (existing: T) => boolean): T {
    const existing = this.map.get(id);
    if (existing === undefined) {
      this.map.set(id, record);
      return record;
    }
    if (!predicate(existing)) {
      throw immutableRecordModification(this.entity, id);
    }
    this.map.set(id, record);
    return record;
  }

  snapshot(): Map<string, T> {
    return new Map(this.map);
  }

  restore(snapshot: Map<string, T>): void {
    this.map.clear();
    for (const [key, value] of snapshot) {
      this.map.set(key, value);
    }
  }
}
