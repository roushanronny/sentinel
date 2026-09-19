import { afterAll, describe, expect, it } from 'vitest';
import {
  buildGatewayApp,
  InMemoryRouteRepository,
  InMemorySecurityEventWriter,
} from './app.js';
import { MemoryRateLimiter, type RoutePattern } from '@sentinel/security';

function baseRoute(overrides: Partial<RoutePattern> = {}): RoutePattern {
  return {
    id: 'route-users',
    organizationId: 'org-1',
    serviceId: 'svc-1',
    method: 'GET',
    path: '/users',
    authRequired: true,
    rateLimitRpm: 100,
    upstreamUrl: 'http://localhost:3002',
    serviceName: 'users-api',
    ...overrides,
  };
}

describe('sentinel-gateway proxy', () => {
  const routes = new InMemoryRouteRepository([baseRoute()]);
  const events = new InMemorySecurityEventWriter();

  const { app } = buildGatewayApp({
    routeRepository: routes,
    securityEvents: events,
    rateLimiter: new MemoryRateLimiter(),
    allowLocalhostUpstream: true,
    fetchImpl: (async () =>
      new Response(JSON.stringify({ data: [{ id: 'u_1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/missing' });
    expect(response.statusCode).toBe(404);
  });

  it('requires authorization for protected routes', async () => {
    const response = await app.inject({ method: 'GET', url: '/users' });
    expect(response.statusCode).toBe(401);
  });

  it('proxies authorized requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [{ id: 'u_1' }] });
  });

  it('blocks cross-tenant organization header mismatch', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: {
        authorization: 'Bearer test-token',
        'x-organization-id': 'org-other',
      },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('sentinel-gateway rate limiting', () => {
  const events = new InMemorySecurityEventWriter();
  const { app } = buildGatewayApp({
    routeRepository: new InMemoryRouteRepository([baseRoute({ rateLimitRpm: 2 })]),
    securityEvents: events,
    rateLimiter: new MemoryRateLimiter(),
    allowLocalhostUpstream: true,
    fetchImpl: (async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch,
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after exceeding route limit', async () => {
    const headers = { authorization: 'Bearer test-token' };
    expect((await app.inject({ method: 'GET', url: '/users', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/users', headers })).statusCode).toBe(200);
    const limited = await app.inject({ method: 'GET', url: '/users', headers });
    expect(limited.statusCode).toBe(429);
    expect(events.events.some((event) => event.eventType === 'RATE_LIMIT_EXCEEDED')).toBe(true);
  });
});
