import { afterAll, describe, expect, it } from 'vitest';
import { buildDemoApp, setFailureMode } from './app.js';

describe('sentinel-demo-service', () => {
  const { app } = buildDemoApp();

  afterAll(async () => {
    setFailureMode('normal');
    await app.close();
  });

  it('returns users in normal mode', async () => {
    setFailureMode('normal');
    const response = await app.inject({ method: 'GET', url: '/users' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: unknown[] };
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('returns 500 in error mode', async () => {
    setFailureMode('error');
    const response = await app.inject({ method: 'GET', url: '/users' });
    expect(response.statusCode).toBe(500);
  });
});
