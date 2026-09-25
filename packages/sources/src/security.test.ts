import { describe, it, expect } from 'vitest';
import { validateRetrievalUrl } from './security.js';

describe('source retrieval security', () => {
  it('allows https URLs', () => {
    expect(() => validateRetrievalUrl('https://example.com/doc')).not.toThrow();
  });

  it('blocks localhost', () => {
    expect(() => validateRetrievalUrl('http://localhost/secret')).toThrow();
  });

  it('blocks file protocol', () => {
    expect(() => validateRetrievalUrl('file:///etc/passwd')).toThrow();
  });
});
