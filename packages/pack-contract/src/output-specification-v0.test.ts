import { describe, it, expect } from 'vitest';
import {
  OutputSpecificationEntrySchema,
  parseDomainPackV0,
  computePackContentHash,
} from './index.js';
import { minimalDomainPack, minimalOutputSpecification } from './test-helpers.js';

describe('OutputSpecificationEntrySchema', () => {
  it('accepts a valid professional output specification', () => {
    const result = OutputSpecificationEntrySchema.safeParse(minimalOutputSpecification('output-spec-001'));
    expect(result.success).toBe(true);
  });

  it('rejects duplicate section ids', () => {
    const spec = minimalOutputSpecification('output-spec-dup-section');
    spec.sections = [
      { ...spec.sections[0]!, id: 'dup', order: 0 },
      { ...spec.sections[1]!, id: 'dup', order: 1 },
    ];
    const result = OutputSpecificationEntrySchema.safeParse(spec);
    expect(result.success).toBe(false);
  });

  it('requires customerConstraints for customer audience', () => {
    const result = OutputSpecificationEntrySchema.safeParse(
      minimalOutputSpecification('output-spec-customer', { audience: 'customer' }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts customer audience with constraints', () => {
    const result = OutputSpecificationEntrySchema.safeParse(
      minimalOutputSpecification('output-spec-customer', {
        audience: 'customer',
        customerConstraints: { maxFindings: 3, excludedSectionIds: [] },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects claim type referencing unknown section', () => {
    const spec = minimalOutputSpecification('output-spec-bad-claim-section');
    spec.claimTypes[0]!.sectionIds = ['missing-section'];
    const result = OutputSpecificationEntrySchema.safeParse(spec);
    expect(result.success).toBe(false);
  });
});

describe('DomainPackV0 outputSpecifications integration', () => {
  it('includes outputSpecifications in pack content hash', () => {
    const without = parseDomainPackV0(minimalDomainPack());
    const withSpec = parseDomainPackV0(
      minimalDomainPack({
        outputSpecifications: [minimalOutputSpecification('output-spec-hash')],
      }),
    );
    expect(computePackContentHash(without)).not.toBe(computePackContentHash(withSpec));
  });
});
