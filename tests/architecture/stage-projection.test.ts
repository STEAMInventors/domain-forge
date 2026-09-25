import { describe, it, expect } from 'vitest';
import { projectStageInput } from '@domain-forge/validation';
import { EXAMPLE_STAGE_DEFINITION } from '@domain-forge/stages';
import { StageProjectionError } from '@domain-forge/core';

describe('stage input projection', () => {
  it('projects only allowed fields', () => {
    const { projected } = projectStageInput(EXAMPLE_STAGE_DEFINITION, {
      'seed-input': {
        content: { seedValue: 10, label: 'test', secretField: 'hidden' },
      },
    });
    expect(projected).toEqual({ seedValue: 10, label: 'test' });
    expect(projected).not.toHaveProperty('secretField');
  });

  it('rejects undeclared artifact types', () => {
    expect(() =>
      projectStageInput(EXAMPLE_STAGE_DEFINITION, {
        'undeclared-artifact': { content: { foo: 'bar' } },
      }),
    ).toThrow(StageProjectionError);
  });
});
