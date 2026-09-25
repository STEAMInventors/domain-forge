import { buildRegistry, type ImmutableRegistry, type RegistryEntryDefinition } from './registry.js';
import { RegistryError } from './registry-error.js';

export type QuestionLanguageRestriction = 'banned' | 'restricted';

export interface QuestionLanguageEntry extends RegistryEntryDefinition {
  readonly phrase: string;
  readonly restriction: QuestionLanguageRestriction;
  readonly reason: string;
}

export const QUESTION_LANGUAGE_VERSION = '1.0.0';

const QUESTION_LANGUAGE_DEFINITIONS: readonly QuestionLanguageEntry[] = [
  {
    id: 'ql-001',
    phrase: 'always',
    restriction: 'banned',
    reason: 'Absolute certainty not permitted',
    description: 'Banned phrase: always',
  },
  {
    id: 'ql-002',
    phrase: 'never',
    restriction: 'banned',
    reason: 'Absolute certainty not permitted',
    description: 'Banned phrase: never',
  },
  {
    id: 'ql-003',
    phrase: 'guarantee',
    restriction: 'banned',
    reason: 'Overpromising outcome',
    description: 'Banned phrase: guarantee',
  },
  {
    id: 'ql-004',
    phrase: 'must definitely',
    restriction: 'restricted',
    reason: 'Requires authority backing',
    description: 'Restricted phrase: must definitely',
  },
];

export const QuestionLanguageRegistry: ImmutableRegistry<QuestionLanguageEntry> = buildRegistry(
  'questionLanguage',
  QUESTION_LANGUAGE_DEFINITIONS,
  { version: QUESTION_LANGUAGE_VERSION },
);

/** Deterministic phrase check — exact substring match on normalized lowercase text. */
export function findBannedQuestionLanguage(text: string): QuestionLanguageEntry | undefined {
  const normalized = text.toLowerCase();
  for (const entry of QuestionLanguageRegistry.list()) {
    if (entry.definition.restriction === 'banned' && normalized.includes(entry.definition.phrase.toLowerCase())) {
      return entry.definition;
    }
  }
  return undefined;
}

export function isBannedQuestionLanguage(text: string): boolean {
  return findBannedQuestionLanguage(text) !== undefined;
}

export interface ProposedQuestionLanguageEntry {
  id: string;
  phrase: string;
  restriction: QuestionLanguageRestriction;
  reason: string;
  description: string;
}

/** Proposed definitions must pass schema validation before registry acceptance. */
export function acceptQuestionLanguageEntry(
  proposed: ProposedQuestionLanguageEntry,
): QuestionLanguageEntry {
  if (!proposed.id || !proposed.phrase || !proposed.reason || !proposed.description) {
    throw new RegistryError('Malformed question language entry', {
      registry: 'questionLanguage',
      code: 'REGISTRY_MALFORMED_ENTRY',
      entryId: proposed.id,
    });
  }
  if (proposed.restriction !== 'banned' && proposed.restriction !== 'restricted') {
    throw new RegistryError('Invalid question language restriction', {
      registry: 'questionLanguage',
      code: 'REGISTRY_MALFORMED_ENTRY',
      entryId: proposed.id,
    });
  }
  return {
    id: proposed.id,
    phrase: proposed.phrase,
    restriction: proposed.restriction,
    reason: proposed.reason,
    description: proposed.description,
  };
}
