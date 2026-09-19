import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

const severitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const statusSchema = z.enum(['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED']);

const createIncidentSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  severity: severitySchema.default('MEDIUM'),
  serviceId: z.string().uuid().optional(),
  securityEventIds: z.array(z.string().uuid()).max(20).optional(),
});

const updateIncidentSchema = z.object({
  status: statusSchema.optional(),
  severity: severitySchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).optional(),
});

const noteSchema = z.object({
  message: z.string().min(1).max(5000),
});

export async function registerIncidentRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/incidents',
    { preHandler: [requireAuth, requirePermission('incidents:read')] },
    async (request) => {
      const auth = request.auth!;
      const incidents = await deps.db.incident.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          service: { select: { id: true, name: true } },
          _count: { select: { events: true } },
        },
      });
      return { data: incidents };
    },
  );

  app.get(
    '/incidents/:incidentId',
    { preHandler: [requireAuth, requirePermission('incidents:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { incidentId } = request.params as { incidentId: string };
      const incident = await deps.db.incident.findFirst({
        where: { id: incidentId, organizationId: auth.organizationId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          service: { select: { id: true, name: true } },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!incident) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Incident not found', requestId: request.id },
        });
      }
      return { data: incident };
    },
  );

  app.post(
    '/incidents',
    { preHandler: [requireAuth, requirePermission('incidents:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const parsed = createIncidentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid incident payload',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      if (parsed.data.serviceId) {
        const service = await deps.db.service.findFirst({
          where: { id: parsed.data.serviceId, organizationId: auth.organizationId },
        });
        if (!service) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_SERVICE',
              message: 'Service not found in this organization',
              requestId: request.id,
            },
          });
        }
      }

      const linkedEvents = parsed.data.securityEventIds?.length
        ? await deps.db.securityEvent.findMany({
            where: {
              organizationId: auth.organizationId,
              id: { in: parsed.data.securityEventIds },
            },
          })
        : [];

      const incident = await deps.db.$transaction(async (tx) => {
        const created = await tx.incident.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: parsed.data.serviceId,
            title: parsed.data.title,
            description: parsed.data.description,
            severity: parsed.data.severity,
            createdById: auth.userId,
            status: 'OPEN',
          },
        });

        await tx.incidentEvent.create({
          data: {
            incidentId: created.id,
            eventType: 'CREATED',
            message: `Incident created by ${auth.email}`,
            metadata: {
              severity: parsed.data.severity,
              linkedSecurityEventIds: linkedEvents.map((event) => event.id),
            },
          },
        });

        for (const event of linkedEvents) {
          await tx.incidentEvent.create({
            data: {
              incidentId: created.id,
              eventType: 'SECURITY_EVENT_LINKED',
              message: `Linked security event ${event.eventType}`,
              metadata: {
                securityEventId: event.id,
                severity: event.severity,
              },
            },
          });
        }

        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            userId: auth.userId,
            action: 'INCIDENT_CREATED',
            resourceType: 'incident',
            resourceId: created.id,
            ipAddress: request.ip,
          },
        });

        return created;
      });

      return reply.code(201).send({ data: incident });
    },
  );

  app.patch(
    '/incidents/:incidentId',
    { preHandler: [requireAuth, requirePermission('incidents:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { incidentId } = request.params as { incidentId: string };
      const parsed = updateIncidentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid incident update',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const existing = await deps.db.incident.findFirst({
        where: { id: incidentId, organizationId: auth.organizationId },
      });
      if (!existing) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Incident not found', requestId: request.id },
        });
      }

      if (parsed.data.assignedToId) {
        const member = await deps.db.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: auth.organizationId,
              userId: parsed.data.assignedToId,
            },
          },
        });
        if (!member) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_ASSIGNEE',
              message: 'Assignee is not a member of this organization',
              requestId: request.id,
            },
          });
        }
      }

      const resolvedAt =
        parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED'
          ? new Date()
          : parsed.data.status
            ? null
            : undefined;

      const incident = await deps.db.$transaction(async (tx) => {
        const updated = await tx.incident.update({
          where: { id: existing.id },
          data: {
            status: parsed.data.status,
            severity: parsed.data.severity,
            description: parsed.data.description,
            assignedToId: parsed.data.assignedToId === undefined ? undefined : parsed.data.assignedToId,
            ...(resolvedAt !== undefined ? { resolvedAt } : {}),
          },
        });

        const changes: string[] = [];
        if (parsed.data.status && parsed.data.status !== existing.status) {
          changes.push(`status → ${parsed.data.status}`);
        }
        if (parsed.data.severity && parsed.data.severity !== existing.severity) {
          changes.push(`severity → ${parsed.data.severity}`);
        }
        if (parsed.data.assignedToId !== undefined) {
          changes.push(
            parsed.data.assignedToId
              ? `assigned to ${parsed.data.assignedToId}`
              : 'unassigned',
          );
        }

        if (changes.length > 0) {
          await tx.incidentEvent.create({
            data: {
              incidentId: updated.id,
              eventType: 'UPDATED',
              message: changes.join('; '),
              metadata: parsed.data as object,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            userId: auth.userId,
            action: 'INCIDENT_UPDATED',
            resourceType: 'incident',
            resourceId: updated.id,
            ipAddress: request.ip,
          },
        });

        return updated;
      });

      return { data: incident };
    },
  );

  app.post(
    '/incidents/:incidentId/notes',
    { preHandler: [requireAuth, requirePermission('incidents:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { incidentId } = request.params as { incidentId: string };
      const parsed = noteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid note payload',
            details: parsed.error.flatten(),
            requestId: request.id,
          },
        });
      }

      const existing = await deps.db.incident.findFirst({
        where: { id: incidentId, organizationId: auth.organizationId },
      });
      if (!existing) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Incident not found', requestId: request.id },
        });
      }

      const event = await deps.db.incidentEvent.create({
        data: {
          incidentId: existing.id,
          eventType: 'NOTE',
          message: parsed.data.message,
          metadata: { authorId: auth.userId, authorEmail: auth.email },
        },
      });

      return reply.code(201).send({ data: event });
    },
  );
}
