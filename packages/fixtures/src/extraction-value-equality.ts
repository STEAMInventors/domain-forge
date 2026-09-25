import type { ExtractionOutcome, ExtractionValue } from '@domain-forge/contracts';

export function extractionValuesEqual(a: ExtractionValue, b: ExtractionValue): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'date':
    case 'enum':
      return a.value === (b as typeof a).value;
    case 'money':
      return a.amount === (b as typeof a).amount && a.currency === (b as typeof a).currency;
    case 'duration':
    case 'quantity':
      return a.value === (b as typeof a).value && a.unitId === (b as typeof a).unitId;
    case 'reference':
      return a.refId === (b as typeof a).refId;
    case 'structured_object': {
      const bFields = (b as typeof a).fields;
      const aKeys = Object.keys(a.fields).sort();
      const bKeys = Object.keys(bFields).sort();
      if (aKeys.length !== bKeys.length) return false;
      for (let i = 0; i < aKeys.length; i += 1) {
        if (aKeys[i] !== bKeys[i]) return false;
        const key = aKeys[i]!;
        if (!extractionValuesEqual(a.fields[key]!, bFields[key]!)) return false;
      }
      return true;
    }
    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

export function extractionOutcomesEqual(
  expected: readonly ExtractionOutcome[],
  actual: readonly ExtractionOutcome[],
): boolean {
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    const e = expected[i]!;
    const a = actual[i]!;
    if (e.kind !== a.kind) return false;
    if (e.kind === 'missingness' && a.kind === 'missingness') {
      if (e.state !== a.state) return false;
      continue;
    }
    if (e.kind === 'value' && a.kind === 'value') {
      if (!extractionValuesEqual(e.value, a.value)) return false;
      continue;
    }
    return false;
  }
  return true;
}
