import { describe, it, expect } from 'vitest';
import { PrimitiveRegistry, InvariantViolationError } from '@domain-forge/core';

describe('registries', () => {
  it('accepts registered primitives', () => {
    expect(PrimitiveRegistry.assert('REQUIRE')).toBe('REQUIRE');
  });

  it('rejects unknown primitives', () => {
    expect(() => PrimitiveRegistry.assert('INVENTED')).toThrow(InvariantViolationError);
  });
});
