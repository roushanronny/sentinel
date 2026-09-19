import { describe, expect, it } from 'vitest';
import { workerMeta } from './processor.js';

describe('event-worker', () => {
  it('exposes worker metadata', () => {
    expect(workerMeta.service).toBe('sentinel-event-worker');
  });
});
