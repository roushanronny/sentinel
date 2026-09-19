import { describe, expect, it } from 'vitest';
import { createRequestId, resolveRequestId } from './index.js';

describe('request id helpers', () => {
  it('creates a non-empty request id', () => {
    const id = createRequestId();
    expect(id.length).toBeGreaterThan(8);
  });

  it('reuses a valid incoming request id', () => {
    const incoming = 'req_abc12345';
    expect(resolveRequestId(incoming)).toBe(incoming);
  });

  it('rejects unsafe incoming request ids', () => {
    const generated = resolveRequestId('bad id with spaces');
    expect(generated).not.toBe('bad id with spaces');
  });
});
