import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

const listAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function registerAuditRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/audit-logs',
    { preHandler: [requireAuth, requirePermission('audit:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const parsed = listAuditQuerySchema.safeParse(request.query);
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

      const logs = await deps.db.auditLog.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: 'desc' },
        take: parsed.data.limit,
      });

      return { data: logs };
    },
  );
}
