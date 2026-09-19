import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

export async function registerOverviewRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/overview',
    { preHandler: [requireAuth, requirePermission('org:read')] },
    async (request) => {
      const auth = request.auth!;
      const orgId = auth.organizationId;

      const [services, openEvents, openIncidents, recentEvents] = await Promise.all([
        deps.db.service.count({ where: { organizationId: orgId } }),
        deps.db.securityEvent.count({
          where: { organizationId: orgId, status: 'OPEN' },
        }),
        deps.db.incident.count({
          where: {
            organizationId: orgId,
            status: { in: ['OPEN', 'INVESTIGATING', 'MITIGATED'] },
          },
        }),
        deps.db.securityEvent.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            eventType: true,
            severity: true,
            description: true,
            createdAt: true,
            status: true,
          },
        }),
      ]);

      return {
        data: {
          services,
          openSecurityEvents: openEvents,
          openIncidents,
          recentSecurityEvents: recentEvents,
        },
      };
    },
  );
}
