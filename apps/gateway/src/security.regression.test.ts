import { afterAll, describe, expect, it } from 'vitest';
import {
  buildGatewayApp,
  InMemoryRouteRepository,
  InMemorySecurityEventWriter,
} from './app.js';
import { MemoryRateLimiter, type RoutePattern } from '@sentinel/security';

describe('gateway security regressions', () => {
  const routes: RoutePattern[] = [
    {
      id: 'r1',
      organizationId: 'org-1',
      serviceId: 'svc-1',
      method: 'GET',
      path: '/users',
      authRequired: false,
      rateLimitRpm: 100,
      upstreamUrl: 'ftp://evil.example',
      serviceName: 'users-api',
    },
    {
      id: 'r2',
      organizationId: 'org-1',
      serviceId: 'svc-1',
      method: 'GET',
      path: '/orders',
      authRequired: false,
      rateLimitRpm: 100,
      upstreamUrl: 'http://localhost:3002',
      serviceName: 'orders-api',
    },
  ];

  const events = new InMemorySecurityEventWriter();
  const { app } = buildGatewayApp({
    routeRepository: new InMemoryRouteRepository(routes),
    securityEvents: events,
    rateLimiter: new MemoryRateLimiter(),
    allowLocalhostUpstream: true,
    fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks unsafe upstream protocols', async () => {
    const response = await app.inject({ method: 'GET', url: '/users' });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('UNSAFE_UPSTREAM');
  });

  it('blocks tenant header mismatch', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/orders',
      headers: { 'x-organization-id': 'org-other' },
    });
    expect(response.statusCode).toBe(403);
  });
});
