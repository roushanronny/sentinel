import { describe, expect, it } from 'vitest';
import { buildAiIdempotencyKey } from './processor.js';

describe('ai-worker', () => {
  it('builds stable-ish idempotency keys', () => {
    const key = buildAiIdempotencyKey('inc', 'user');
    expect(key.length).toBe(64);
  });
});
