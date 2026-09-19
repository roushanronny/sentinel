import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import { isSafeUpstreamUrl } from '@sentinel/security';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

const createServiceSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'name must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  environment: z.string().min(2).max(40).default('development'),
  upstreamUrl: z.string().url(),
});

const updateServiceSchema = z.object({
  description: z.string().max(500).optional(),
  environment: z.string().min(2).max(40).optional(),
  upstreamUrl: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEGRADED']).optional(),
});

export async function registerServiceRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/services',
    { preHandler: [requireAuth, requirePermission('services:read')] },
    async (request) => {
      const auth = request.auth!;
      const services = await deps.db.service.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { routes: true } } },
      });
      return { data: services };
    },
  );

  app.get(
    '/services/:serviceId',
    { preHandler: [requireAuth, requirePermission('services:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { serviceId } = request.params as { serviceId: string };
      const service = await deps.db.service.findFirst({
        where: { id: serviceId, organizationId: auth.organizationId },
        include: { routes: true },
      });
      if (!service) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id },
        });
      }
      return { data: service };
    },
  );

  app.post(
    '/services',
    { preHandler: [requireAuth, requirePermission('services:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const parsed = createServiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid service payload',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const allowLocalhost = deps.env.NODE_ENV !== 'production';
      if (!isSafeUpstreamUrl(parsed.data.upstreamUrl, { allowLocalhost })) {
        return reply.code(400).send({
          error: {
            code: 'UNSAFE_UPSTREAM_URL',
            message: 'Upstream URL is not allowed',
            requestId: request.id,
          },
        });
      }

      try {
        const service = await deps.db.service.create({
          data: {
            organizationId: auth.organizationId,
            name: parsed.data.name,
            description: parsed.data.description,
            environment: parsed.data.environment,
            upstreamUrl: parsed.data.upstreamUrl,
          },
        });

        await deps.db.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            userId: auth.userId,
            action: 'SERVICE_CREATED',
            resourceType: 'service',
            resourceId: service.id,
            ipAddress: request.ip,
          },
        });

        return reply.code(201).send({ data: service });
      } catch {
        return reply.code(409).send({
          error: {
            code: 'SERVICE_EXISTS',
            message: 'A service with this name already exists',
            requestId: request.id,
          },
        });
      }
    },
  );

  app.patch(
    '/services/:serviceId',
    { preHandler: [requireAuth, requirePermission('services:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { serviceId } = request.params as { serviceId: string };
      const parsed = updateServiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid service update payload',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const existing = await deps.db.service.findFirst({
        where: { id: serviceId, organizationId: auth.organizationId },
      });
      if (!existing) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Service not found', requestId: request.id },
        });
      }

      if (parsed.data.upstreamUrl) {
        const allowLocalhost = deps.env.NODE_ENV !== 'production';
        if (!isSafeUpstreamUrl(parsed.data.upstreamUrl, { allowLocalhost })) {
          return reply.code(400).send({
            error: {
              code: 'UNSAFE_UPSTREAM_URL',
              message: 'Upstream URL is not allowed',
              requestId: request.id,
            },
          });
        }
      }

      const service = await deps.db.service.update({
        where: { id: existing.id },
        data: parsed.data,
      });

      await deps.db.auditLog.create({
        data: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          action: 'SERVICE_UPDATED',
          resourceType: 'service',
          resourceId: service.id,
          ipAddress: request.ip,
        },
      });

      return { data: service };
    },
  );
}
