import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

const listEventsQuerySchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const updateEventSchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE']),
});

export async function registerSecurityEventRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/security-events',
    { preHandler: [requireAuth, requirePermission('security_events:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const parsed = listEventsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const events = await deps.db.securityEvent.findMany({
        where: {
          organizationId: auth.organizationId,
          ...(parsed.data.severity ? { severity: parsed.data.severity } : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: parsed.data.limit,
      });

      return { data: events };
    },
  );

  app.get(
    '/security-events/:eventId',
    { preHandler: [requireAuth, requirePermission('security_events:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { eventId } = request.params as { eventId: string };
      const event = await deps.db.securityEvent.findFirst({
        where: { id: eventId, organizationId: auth.organizationId },
      });
      if (!event) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Security event not found', requestId: request.id },
        });
      }
      return { data: event };
    },
  );

  app.patch(
    '/security-events/:eventId',
    { preHandler: [requireAuth, requirePermission('incidents:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { eventId } = request.params as { eventId: string };
      const parsed = updateEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update payload',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const existing = await deps.db.securityEvent.findFirst({
        where: { id: eventId, organizationId: auth.organizationId },
      });
      if (!existing) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Security event not found', requestId: request.id },
        });
      }

      const event = await deps.db.securityEvent.update({
        where: { id: existing.id },
        data: { status: parsed.data.status },
      });

      await deps.db.auditLog.create({
        data: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          action: 'SECURITY_EVENT_UPDATED',
          resourceType: 'security_event',
          resourceId: event.id,
          ipAddress: request.ip,
          metadata: { status: parsed.data.status },
        },
      });

      return { data: event };
    },
  );
}
