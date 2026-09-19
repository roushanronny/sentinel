import { describe, expect, it } from 'vitest';
import type { HealthResponse } from './index.js';

describe('@sentinel/types', () => {
  it('accepts a valid health response shape', () => {
    const health: HealthResponse = {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };

    expect(health.status).toBe('ok');
    expect(health.service).toBe('api');
  });
});
