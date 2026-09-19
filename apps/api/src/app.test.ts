import { afterAll, describe, expect, it } from 'vitest';
import { buildApiApp } from './app.js';

describe('sentinel-api health', () => {
  const { app } = buildApiApp();

  afterAll(async () => {
    await app.close();
  });

  it('returns ok from /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('sentinel-api');
  });
});
