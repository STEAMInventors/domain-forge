/** Deep-freeze plain objects for stage execution immutability guarantees */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    const property = (value as Record<string, unknown>)[key];
    if (property !== null && typeof property === 'object' && !Object.isFrozen(property)) {
      deepFreeze(property);
    }
  }

  return value;
}
