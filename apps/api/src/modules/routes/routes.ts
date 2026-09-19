import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);

const createRouteSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^\//, 'path must start with /'),
  method: httpMethodSchema,
  authRequired: z.boolean().default(true),
  rateLimitRpm: z.number().int().min(1).max(100000).default(100),
  requestSchema: z.unknown().optional(),
});

export async function registerApiRouteRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/services/:serviceId/routes',
    { preHandler: [requireAuth, requirePermission('routes:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { serviceId } = request.params as { serviceId: string };

      const service = await deps.db.service.findFirst({
        where: { id: serviceId, organizationId: auth.organizationId },
      });
      if (!service) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id },
        });
      }

      const routes = await deps.db.apiRoute.findMany({
        where: { serviceId: service.id },
        orderBy: [{ path: 'asc' }, { method: 'asc' }],
      });
      return { data: routes };
    },
  );

  app.post(
    '/services/:serviceId/routes',
    { preHandler: [requireAuth, requirePermission('routes:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { serviceId } = request.params as { serviceId: string };
      const parsed = createRouteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid route payload',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const service = await deps.db.service.findFirst({
        where: { id: serviceId, organizationId: auth.organizationId },
      });
      if (!service) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id },
        });
      }

      try {
        const route = await deps.db.apiRoute.create({
          data: {
            serviceId: service.id,
            path: parsed.data.path,
            method: parsed.data.method,
            authRequired: parsed.data.authRequired,
            rateLimitRpm: parsed.data.rateLimitRpm,
            requestSchema: parsed.data.requestSchema as object | undefined,
          },
        });

        await deps.db.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            userId: auth.userId,
            action: 'API_ROUTE_CREATED',
            resourceType: 'api_route',
            resourceId: route.id,
            ipAddress: request.ip,
          },
        });

        return reply.code(201).send({ data: route });
      } catch {
        return reply.code(409).send({
          error: {
            code: 'ROUTE_EXISTS',
            message: 'Route with this method and path already exists',
            requestId: request.id,
          },
        });
      }
    },
  );

  app.delete(
    '/services/:serviceId/routes/:routeId',
    { preHandler: [requireAuth, requirePermission('routes:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { serviceId, routeId } = request.params as { serviceId: string; routeId: string };

      const service = await deps.db.service.findFirst({
        where: { id: serviceId, organizationId: auth.organizationId },
      });
      if (!service) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id },
        });
      }

      const route = await deps.db.apiRoute.findFirst({
        where: { id: routeId, serviceId: service.id },
      });
      if (!route) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Route not found', requestId: request.id },
        });
      }

      await deps.db.apiRoute.delete({ where: { id: route.id } });
      await deps.db.auditLog.create({
        data: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          action: 'API_ROUTE_DELETED',
          resourceType: 'api_route',
          resourceId: route.id,
          ipAddress: request.ip,
        },
      });

      return reply.code(204).send();
    },
  );
}
