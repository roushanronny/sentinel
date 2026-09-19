import { describe, expect, it } from 'vitest';
import { loadEnv } from './index.js';

describe('loadEnv', () => {
  it('loads defaults for local development', () => {
    const env = loadEnv({});
    expect(env.API_PORT).toBe(3001);
    expect(env.GATEWAY_PORT).toBe(3000);
    expect(env.DEMO_SERVICE_PORT).toBe(3002);
  });

  it('parses numeric ports from strings', () => {
    const env = loadEnv({ API_PORT: '4001' });
    expect(env.API_PORT).toBe(4001);
  });
});
