import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { loadEnv, type Env } from '@sentinel/config';
import { prisma, type PrismaClient } from '@sentinel/database';
import { createLogger } from '@sentinel/logger';
import {
  InMemoryPublisher,
  RabbitMqPublisher,
  type MessagePublisher,
  type SecurityEventMessage,
} from '@sentinel/messaging';
import {
  buildUpstreamTarget,
  findMatchingRoute,
  isSafeUpstreamUrl,
  MemoryRateLimiter,
  RedisRateLimiter,
  type RateLimiter,
  type RoutePattern,
} from '@sentinel/security';
import { initTelemetry, withSpan } from '@sentinel/telemetry';
import type { HealthResponse } from '@sentinel/types';
import { getRequestIdHeaderName, resolveRequestId } from '@sentinel/utils';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

export interface RouteRepository {
  listActiveRoutes(): Promise<RoutePattern[]>;
}

export class PrismaRouteRepository implements RouteRepository {
  private cache: { expiresAt: number; routes: RoutePattern[] } | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly ttlMs = 5_000,
  ) {}

  async listActiveRoutes(): Promise<RoutePattern[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.routes;
    }

    const routes = await this.db.apiRoute.findMany({
      where: { service: { status: 'ACTIVE' } },
      include: { service: true },
    });

    const mapped = routes.map((route) => ({
      id: route.id,
      organizationId: route.service.organizationId,
      serviceId: route.serviceId,
      method: route.method,
      path: route.path,
      authRequired: route.authRequired,
      rateLimitRpm: route.rateLimitRpm,
      upstreamUrl: route.service.upstreamUrl,
      serviceName: route.service.name,
    }));

    this.cache = { routes: mapped, expiresAt: now + this.ttlMs };
    return mapped;
  }
}

export class InMemoryRouteRepository implements RouteRepository {
  constructor(private routes: RoutePattern[] = []) {}

  setRoutes(routes: RoutePattern[]): void {
    this.routes = routes;
  }

  async listActiveRoutes(): Promise<RoutePattern[]> {
    return this.routes;
  }
}

export interface SecurityEventWriter {
  write(event: {
    organizationId: string;
    serviceId?: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sourceIp?: string;
    requestId?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

function toIdempotencyKey(event: {
  organizationId: string;
  eventType: string;
  requestId?: string;
  description: string;
}): string {
  return createHash('sha256')
    .update(
      [event.organizationId, event.eventType, event.requestId ?? '', event.description].join('|'),
    )
    .digest('hex');
}

export class QueuedSecurityEventWriter implements SecurityEventWriter {
  constructor(private readonly publisher: MessagePublisher) {}

  async write(event: {
    organizationId: string;
    serviceId?: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sourceIp?: string;
    requestId?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const message: SecurityEventMessage = {
      idempotencyKey: toIdempotencyKey(event),
      organizationId: event.organizationId,
      serviceId: event.serviceId,
      eventType: event.eventType,
      severity: event.severity,
      sourceIp: event.sourceIp,
      requestId: event.requestId,
      description: event.description,
      metadata: event.metadata,
      occurredAt: new Date().toISOString(),
    };
    await this.publisher.publishSecurityEvent(message);
  }
}

export class PrismaSecurityEventWriter implements SecurityEventWriter {
  constructor(private readonly db: PrismaClient) {}

  async write(event: {
    organizationId: string;
    serviceId?: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sourceIp?: string;
    requestId?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.securityEvent.create({
      data: {
        organizationId: event.organizationId,
        serviceId: event.serviceId,
        eventType: event.eventType,
        severity: event.severity,
        sourceIp: event.sourceIp,
        requestId: event.requestId,
        description: event.description,
        metadata: event.metadata ? (event.metadata as object) : undefined,
      },
    });
  }
}

export class InMemorySecurityEventWriter implements SecurityEventWriter {
  readonly events: Array<Record<string, unknown>> = [];

  async write(event: {
    organizationId: string;
    serviceId?: string;
    eventType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    sourceIp?: string;
    requestId?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    this.events.push(event);
  }
}

export interface GatewayDeps {
  env?: Env;
  routeRepository?: RouteRepository;
  rateLimiter?: RateLimiter;
  securityEvents?: SecurityEventWriter;
  fetchImpl?: typeof fetch;
  upstreamTimeoutMs?: number;
  allowLocalhostUpstream?: boolean;
  maxBodyBytes?: number;
}

export function buildGatewayApp(deps: GatewayDeps = {}): {
  app: FastifyInstance;
  env: Env;
  securityEvents: SecurityEventWriter;
} {
  const env = deps.env ?? loadEnv();
  const logger = createLogger({ service: 'sentinel-gateway', level: env.LOG_LEVEL });
  const { tracer, meter } = initTelemetry('sentinel-gateway');
  const requestCounter = meter.createCounter('sentinel_gateway_requests_total');
  const routeRepository = deps.routeRepository ?? new PrismaRouteRepository(prisma);
  const rateLimiter = deps.rateLimiter ?? new MemoryRateLimiter();
  const securityEvents = deps.securityEvents ?? new InMemorySecurityEventWriter();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const upstreamTimeoutMs = deps.upstreamTimeoutMs ?? 5_000;
  const allowLocalhostUpstream =
    deps.allowLocalhostUpstream ?? env.NODE_ENV !== 'production';
  const maxBodyBytes = deps.maxBodyBytes ?? 1_048_576;

  const app: FastifyInstance = Fastify({
    logger: false,
    bodyLimit: maxBodyBytes,
    genReqId: (req) => resolveRequestId(req.headers[getRequestIdHeaderName()]),
    requestIdHeader: getRequestIdHeaderName(),
  });

  app.log = logger as FastifyInstance['log'];

  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'sentinel-gateway',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'sentinel-gateway',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.all('/*', async (request, reply) => {
    await withSpan(
      tracer,
      'gateway.proxy',
      {
        'http.method': request.method,
        'http.route': request.url.split('?')[0] ?? '/',
      },
      async () => {
        await proxyRequest(request, reply, {
          routeRepository,
          rateLimiter,
          securityEvents,
          fetchImpl,
          upstreamTimeoutMs,
          allowLocalhostUpstream,
          maxBodyBytes,
          requestCounter,
        });
      },
    );
  });

  return { app, env, securityEvents };
}

async function proxyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: {
    routeRepository: RouteRepository;
    rateLimiter: RateLimiter;
    securityEvents: SecurityEventWriter;
    fetchImpl: typeof fetch;
    upstreamTimeoutMs: number;
    allowLocalhostUpstream: boolean;
    maxBodyBytes: number;
    requestCounter: { add: (value: number, attributes?: Record<string, string>) => void };
  },
): Promise<void> {
  const path = request.url.split('?')[0] ?? '/';
  const queryString = request.url.includes('?')
    ? request.url.slice(request.url.indexOf('?') + 1)
    : '';

  if (path === '/health' || path === '/ready') {
    return;
  }

  const routes = await deps.routeRepository.listActiveRoutes();
  const match = findMatchingRoute(routes, request.method, path);

  if (!match) {
    deps.requestCounter.add(1, { result: 'route_not_found' });
    await reply.code(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'No registered gateway route matches this request',
        requestId: request.id,
      },
    });
    return;
  }

  const { route } = match;

  if (!isSafeUpstreamUrl(route.upstreamUrl, { allowLocalhost: deps.allowLocalhostUpstream })) {
    await deps.securityEvents.write({
      organizationId: route.organizationId,
      serviceId: route.serviceId,
      eventType: 'UNSAFE_UPSTREAM',
      severity: 'CRITICAL',
      sourceIp: request.ip,
      requestId: String(request.id),
      description: 'Blocked proxy attempt due to unsafe upstream URL configuration',
    });
    deps.requestCounter.add(1, { result: 'unsafe_upstream' });
    await reply.code(500).send({
      error: {
        code: 'UNSAFE_UPSTREAM',
        message: 'Configured upstream is not allowed',
        requestId: request.id,
      },
    });
    return;
  }

  const orgHeader = request.headers['x-organization-id'];
  if (typeof orgHeader === 'string' && orgHeader !== route.organizationId) {
    await deps.securityEvents.write({
      organizationId: route.organizationId,
      serviceId: route.serviceId,
      eventType: 'TENANT_MISMATCH',
      severity: 'HIGH',
      sourceIp: request.ip,
      requestId: String(request.id),
      description: 'Request organization header did not match route tenant',
    });
    deps.requestCounter.add(1, { result: 'tenant_mismatch' });
    await reply.code(403).send({
      error: {
        code: 'TENANT_MISMATCH',
        message: 'Organization context does not match route tenant',
        requestId: request.id,
      },
    });
    return;
  }

  const rateKey = `rate:${route.organizationId}:${route.id}`;
  const rate = await deps.rateLimiter.consume(rateKey, route.rateLimitRpm, 60_000);
  reply.header('X-RateLimit-Limit', rate.limit);
  reply.header('X-RateLimit-Remaining', rate.remaining);
  reply.header('X-RateLimit-Reset', Math.ceil(rate.resetAtMs / 1000));
  reply.header('X-Sentinel-Service', route.serviceName);
  reply.header('X-Sentinel-Route', `${route.method} ${route.path}`);

  if (!rate.allowed) {
    await deps.securityEvents.write({
      organizationId: route.organizationId,
      serviceId: route.serviceId,
      eventType: 'RATE_LIMIT_EXCEEDED',
      severity: 'MEDIUM',
      sourceIp: request.ip,
      requestId: String(request.id),
      description: `Rate limit exceeded for route ${route.method} ${route.path}`,
      metadata: { limit: rate.limit, routeId: route.id },
    });
    if (rate.retryAfterSeconds) {
      reply.header('Retry-After', rate.retryAfterSeconds);
    }
    deps.requestCounter.add(1, { result: 'rate_limited' });
    await reply.code(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        requestId: request.id,
      },
    });
    return;
  }

  if (route.authRequired) {
    const authorization = request.headers.authorization;
    if (!authorization) {
      await deps.securityEvents.write({
        organizationId: route.organizationId,
        serviceId: route.serviceId,
        eventType: 'AUTH_FAILURE',
        severity: 'MEDIUM',
        sourceIp: request.ip,
        requestId: String(request.id),
        description: 'Missing authorization header for protected route',
      });
      deps.requestCounter.add(1, { result: 'unauthorized' });
      await reply.code(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization required',
          requestId: request.id,
        },
      });
      return;
    }
  }

  const contentLengthHeader = request.headers['content-length'];
  const contentLength =
    typeof contentLengthHeader === 'string' ? Number(contentLengthHeader) : undefined;
  if (
    contentLength !== undefined &&
    Number.isFinite(contentLength) &&
    contentLength > deps.maxBodyBytes
  ) {
    deps.requestCounter.add(1, { result: 'payload_too_large' });
    await reply.code(413).send({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds ${deps.maxBodyBytes} byte limit`,
        requestId: request.id,
      },
    });
    return;
  }

  const target = buildUpstreamTarget(route.upstreamUrl, path, queryString);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  headers.set(getRequestIdHeaderName(), String(request.id));
  headers.set('x-sentinel-service', route.serviceName);
  headers.set('x-organization-id', route.organizationId);

  let body: string | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (request.body === undefined || request.body === null) {
      body = undefined;
    } else if (typeof request.body === 'string') {
      body = request.body;
    } else {
      body = JSON.stringify(request.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deps.upstreamTimeoutMs);

  try {
    const upstreamResponse = await deps.fetchImpl(target, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    });

    const responseHeaders: Record<string, string> = {};
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });
    responseHeaders[getRequestIdHeaderName()] = String(request.id);
    responseHeaders['x-sentinel-upstream-status'] = String(upstreamResponse.status);

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    deps.requestCounter.add(1, {
      result: 'proxied',
      status_class: `${Math.floor(upstreamResponse.status / 100)}xx`,
    });
    await reply.code(upstreamResponse.status).headers(responseHeaders).send(buffer);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    await deps.securityEvents.write({
      organizationId: route.organizationId,
      serviceId: route.serviceId,
      eventType: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      severity: 'HIGH',
      sourceIp: request.ip,
      requestId: String(request.id),
      description: isTimeout ? 'Upstream request timed out' : 'Upstream request failed',
    });
    deps.requestCounter.add(1, { result: isTimeout ? 'timeout' : 'upstream_error' });
    await reply.code(isTimeout ? 504 : 502).send({
      error: {
        code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
        message: isTimeout ? 'Upstream timed out' : 'Upstream request failed',
        requestId: request.id,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function startGatewayServer(): Promise<void> {
  const env = loadEnv();
  let rateLimiter: RateLimiter = new MemoryRateLimiter();
  let redisClient: import('@sentinel/redis').Redis | undefined;
  let publisher: MessagePublisher | null = null;
  let usingRabbit = false;

  try {
    const { createRedisClient, connectRedis } = await import('@sentinel/redis');
    redisClient = createRedisClient(env.REDIS_URL);
    await connectRedis(redisClient);
    await redisClient.ping();
    rateLimiter = new RedisRateLimiter(redisClient);
  } catch {
    rateLimiter = new MemoryRateLimiter();
  }

  try {
    const rabbit = new RabbitMqPublisher(env.RABBITMQ_URL);
    await rabbit.connect();
    publisher = rabbit;
    usingRabbit = true;
  } catch {
    publisher = null;
    usingRabbit = false;
  }

  const securityEvents =
    usingRabbit && publisher
      ? new QueuedSecurityEventWriter(publisher)
      : new PrismaSecurityEventWriter(prisma);

  const { app } = buildGatewayApp({
    env,
    rateLimiter,
    securityEvents,
  });

  if (rateLimiter instanceof MemoryRateLimiter) {
    app.log.warn('Gateway using in-memory rate limiter (Redis unavailable)');
  } else {
    app.log.info('Gateway using Redis rate limiter');
  }

  if (usingRabbit) {
    app.log.info('Gateway publishing security events to RabbitMQ');
  } else {
    app.log.warn('Gateway writing security events synchronously (RabbitMQ unavailable)');
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down gateway');
    await app.close();
    await publisher?.close().catch(() => undefined);
    if (redisClient) {
      await redisClient.quit().catch(() => undefined);
    }
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.GATEWAY_HOST, port: env.GATEWAY_PORT });
  app.log.info({ port: env.GATEWAY_PORT }, 'Sentinel Gateway listening');
}
