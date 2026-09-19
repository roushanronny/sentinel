import { describe, expect, it } from 'vitest';
import { assertPermission, hasPermission, assertSameTenant, AuthorizationError } from './rbac.js';
import { MemoryRateLimiter } from './rate-limit.js';
import { RedisRateLimiter, type RedisLike } from './redis-rate-limit.js';
import {
  findMatchingRoute,
  isSafeUpstreamUrl,
  matchRoutePath,
  type RoutePattern,
} from './route-match.js';

describe('rbac', () => {
  it('allows OWNER to manage members', () => {
    expect(hasPermission('OWNER', 'members:manage')).toBe(true);
  });

  it('denies VIEWER from writing services', () => {
    expect(hasPermission('VIEWER', 'services:write')).toBe(false);
    expect(() => assertPermission('VIEWER', 'services:write')).toThrow(AuthorizationError);
  });

  it('enforces tenant equality', () => {
    expect(() => assertSameTenant('org-a', 'org-b')).toThrow(AuthorizationError);
    expect(() => assertSameTenant('org-a', 'org-a')).not.toThrow();
  });
});

describe('route matching', () => {
  const routes: RoutePattern[] = [
    {
      id: 'r1',
      organizationId: 'org1',
      serviceId: 'svc1',
      method: 'GET',
      path: '/users/:id',
      authRequired: true,
      rateLimitRpm: 100,
      upstreamUrl: 'http://localhost:3002',
      serviceName: 'users-api',
    },
    {
      id: 'r2',
      organizationId: 'org1',
      serviceId: 'svc1',
      method: 'GET',
      path: '/users',
      authRequired: true,
      rateLimitRpm: 100,
      upstreamUrl: 'http://localhost:3002',
      serviceName: 'users-api',
    },
  ];

  it('matches parameterized paths', () => {
    const params = matchRoutePath('/users/:id', '/users/u_42');
    expect(params).toEqual({ id: 'u_42' });
  });

  it('finds the correct route by method and path', () => {
    const match = findMatchingRoute(routes, 'GET', '/users/u_9');
    expect(match?.route.id).toBe('r1');
    expect(match?.params.id).toBe('u_9');
  });

  it('rejects unsafe upstream URLs by default', () => {
    expect(isSafeUpstreamUrl('http://localhost:3002')).toBe(false);
    expect(isSafeUpstreamUrl('http://localhost:3002', { allowLocalhost: true })).toBe(true);
    expect(isSafeUpstreamUrl('ftp://example.com')).toBe(false);
    expect(isSafeUpstreamUrl('http://user:pass@example.com')).toBe(false);
  });
});

describe('memory rate limiter', () => {
  it('blocks after limit is exceeded', async () => {
    const limiter = new MemoryRateLimiter();
    expect((await limiter.consume('k', 2, 60_000)).allowed).toBe(true);
    expect((await limiter.consume('k', 2, 60_000)).allowed).toBe(true);
    expect((await limiter.consume('k', 2, 60_000)).allowed).toBe(false);
  });
});

describe('redis rate limiter', () => {
  it('uses redis incr semantics via stub', async () => {
    const store = new Map<string, number>();
    const redis: RedisLike = {
      async incr(key) {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      },
      async pexpire() {
        return 1;
      },
      async pttl() {
        return 30_000;
      },
    };

    const limiter = new RedisRateLimiter(redis);
    expect((await limiter.consume('tenant:route', 2, 60_000)).allowed).toBe(true);
    expect((await limiter.consume('tenant:route', 2, 60_000)).allowed).toBe(true);
    expect((await limiter.consume('tenant:route', 2, 60_000)).allowed).toBe(false);
  });
});
