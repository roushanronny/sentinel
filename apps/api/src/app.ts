import Fastify, { type FastifyInstance } from 'fastify';
import { AuthService } from '@sentinel/auth';
import { loadEnv, type Env } from '@sentinel/config';
import { prisma, type PrismaClient } from '@sentinel/database';
import { createLogger } from '@sentinel/logger';
import { initTelemetry } from '@sentinel/telemetry';
import type { HealthResponse } from '@sentinel/types';
import { getRequestIdHeaderName, resolveRequestId } from '@sentinel/utils';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerOrgRoutes } from './modules/organizations/routes.js';
import { registerServiceRoutes } from './modules/services/routes.js';
import { registerApiRouteRoutes } from './modules/routes/routes.js';
import { registerSecurityEventRoutes } from './modules/security-events/routes.js';
import { registerAuditRoutes } from './modules/audit/routes.js';
import { registerOverviewRoutes } from './modules/overview/routes.js';
import { registerIncidentRoutes } from './modules/incidents/routes.js';
import { registerAiRoutes } from './modules/ai/routes.js';
import { registerCors } from './plugins/cors.js';

export interface ApiDeps {
  db?: PrismaClient;
  env?: Env;
}

export function buildApiApp(deps: ApiDeps = {}): { app: FastifyInstance; env: Env } {
  const env = deps.env ?? loadEnv();
  const db = deps.db ?? prisma;
  const logger = createLogger({ service: 'sentinel-api', level: env.LOG_LEVEL });
  initTelemetry('sentinel-api');

  const app: FastifyInstance = Fastify({
    logger: false,
    genReqId: (req) => resolveRequestId(req.headers[getRequestIdHeaderName()]),
    requestIdHeader: getRequestIdHeaderName(),
  });

  app.log = logger as FastifyInstance['log'];

  void registerCors(app);

  const auth = new AuthService(db, {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    refreshTtlSeconds: env.JWT_REFRESH_TTL_SECONDS,
  });

  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'sentinel-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'sentinel-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  void registerAuthRoutes(app, { auth, env, db });
  void registerOrgRoutes(app, { db, env });
  void registerServiceRoutes(app, { db, env });
  void registerApiRouteRoutes(app, { db, env });
  void registerSecurityEventRoutes(app, { db, env });
  void registerAuditRoutes(app, { db, env });
  void registerOverviewRoutes(app, { db, env });
  void registerIncidentRoutes(app, { db, env });
  void registerAiRoutes(app, { db, env });

  return { app, env };
}

export async function startApiServer(): Promise<void> {
  const { app, env } = buildApiApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down API server');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info({ port: env.API_PORT }, 'Sentinel API listening');
}
