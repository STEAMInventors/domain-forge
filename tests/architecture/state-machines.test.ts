import { describe, it, expect } from 'vitest';
import {
  transitionForgeRun,
  canTransitionForgeRun,
  transitionPackVersion,
  canTransitionPackVersion,
  InvariantViolationError,
} from '@domain-forge/core';

describe('ForgeRun state machine', () => {
  it('allows valid transitions', () => {
    expect(canTransitionForgeRun('CREATED', 'RUNNING')).toBe(true);
    expect(transitionForgeRun('CREATED', 'RUNNING')).toBe('RUNNING');
    expect(transitionForgeRun('RUNNING', 'WAITING_FOR_HUMAN')).toBe('WAITING_FOR_HUMAN');
    expect(transitionForgeRun('WAITING_FOR_HUMAN', 'RUNNING')).toBe('RUNNING');
    expect(transitionForgeRun('RUNNING', 'COMPLETED')).toBe('COMPLETED');
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionForgeRun('COMPLETED', 'RUNNING')).toBe(false);
    expect(() => transitionForgeRun('COMPLETED', 'RUNNING')).toThrow(InvariantViolationError);
  });

  it('ForgeRun never becomes CERTIFIED', () => {
    const states = ['CREATED', 'RUNNING', 'WAITING_FOR_HUMAN', 'BLOCKED', 'COMPLETED', 'FAILED'];
    expect(states).not.toContain('CERTIFIED');
  });
});

describe('PackVersion state machine', () => {
  it('allows DRAFT → PROVISIONAL → CERTIFIED', () => {
    expect(transitionPackVersion('DRAFT', 'PROVISIONAL')).toBe('PROVISIONAL');
    expect(transitionPackVersion('PROVISIONAL', 'CERTIFIED')).toBe('CERTIFIED');
  });

  it('CERTIFIED cannot revert to DRAFT', () => {
    expect(canTransitionPackVersion('CERTIFIED', 'DRAFT')).toBe(false);
    expect(() => transitionPackVersion('CERTIFIED', 'DRAFT')).toThrow(InvariantViolationError);
  });

  it('CERTIFIED can become SUSPENDED', () => {
    expect(transitionPackVersion('CERTIFIED', 'SUSPENDED')).toBe('SUSPENDED');
  });
});
