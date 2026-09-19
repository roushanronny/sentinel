import Fastify, { type FastifyInstance } from 'fastify';
import { loadEnv, type Env } from '@sentinel/config';
import { createLogger } from '@sentinel/logger';
import type { HealthResponse } from '@sentinel/types';
import { getRequestIdHeaderName, resolveRequestId } from '@sentinel/utils';

export type FailureMode = 'normal' | 'slow' | 'error';

let failureMode: FailureMode = 'normal';

export function getFailureMode(): FailureMode {
  return failureMode;
}

export function setFailureMode(mode: FailureMode): void {
  failureMode = mode;
}

export function buildDemoApp(): { app: FastifyInstance; env: Env } {
  const env = loadEnv();
  const logger = createLogger({ service: 'sentinel-demo-service', level: env.LOG_LEVEL });

  const app: FastifyInstance = Fastify({
    logger: false,
    genReqId: (req) => resolveRequestId(req.headers[getRequestIdHeaderName()]),
    requestIdHeader: getRequestIdHeaderName(),
  });

  app.log = logger as FastifyInstance['log'];

  app.get('/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'sentinel-demo-service',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/demo/failure-mode', async () => ({ mode: failureMode }));

  app.post<{ Body: { mode?: string } }>('/demo/failure-mode', async (request, reply) => {
    const mode = request.body?.mode;
    if (mode !== 'normal' && mode !== 'slow' && mode !== 'error') {
      return reply.code(400).send({
        error: {
          code: 'INVALID_FAILURE_MODE',
          message: 'mode must be one of: normal, slow, error',
        },
      });
    }
    setFailureMode(mode);
    return { mode: failureMode };
  });

  app.get('/users', async (_request, reply) => {
    if (failureMode === 'error') {
      return reply.code(500).send({
        error: { code: 'UPSTREAM_ERROR', message: 'Simulated upstream failure' },
      });
    }
    if (failureMode === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    return {
      data: [
        { id: 'u_1', name: 'Asha Verma', email: 'asha@example.com' },
        { id: 'u_2', name: 'Rohan Mehta', email: 'rohan@example.com' },
      ],
    };
  });

  app.get('/orders', async (_request, reply) => {
    if (failureMode === 'error') {
      return reply.code(500).send({
        error: { code: 'UPSTREAM_ERROR', message: 'Simulated upstream failure' },
      });
    }
    if (failureMode === 'slow') {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    return {
      data: [
        { id: 'o_1', userId: 'u_1', total: 1499, status: 'PAID' },
        { id: 'o_2', userId: 'u_2', total: 799, status: 'PENDING' },
      ],
    };
  });

  return { app, env };
}

export async function startDemoServer(): Promise<void> {
  const { app, env } = buildDemoApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down demo service');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.DEMO_SERVICE_HOST, port: env.DEMO_SERVICE_PORT });
  app.log.info({ port: env.DEMO_SERVICE_PORT }, 'Sentinel demo service listening');
}
