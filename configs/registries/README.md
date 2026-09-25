System registries are defined in `@domain-forge/core` (`packages/core/src/registries/`).

Pack-defined registries (document types, vocabulary, entities, facts, rules, etc.) resolve from composed Domain Pack content via `createPackRegistries`.

Source tier classification configuration lives in `@domain-forge/sources` (`SourceClassificationRegistry`, `SourceTierResolver`).

Versioned registry data files may be added here in future passes.
