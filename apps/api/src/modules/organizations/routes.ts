import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

export async function registerOrgRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/organizations/current',
    { preHandler: [requireAuth, requirePermission('org:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const organization = await deps.db.organization.findFirst({
        where: { id: auth.organizationId },
      });
      if (!organization) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Organization not found', requestId: request.id },
        });
      }
      return {
        data: {
          ...organization,
          role: auth.role,
        },
      };
    },
  );

  app.get(
    '/organizations/current/members',
    { preHandler: [requireAuth, requirePermission('members:read')] },
    async (request) => {
      const auth = request.auth!;
      const members = await deps.db.organizationMember.findMany({
        where: { organizationId: auth.organizationId },
        include: {
          user: {
            select: { id: true, email: true, name: true, status: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        data: members.map((member) => ({
          id: member.id,
          role: member.role,
          createdAt: member.createdAt,
          user: member.user,
        })),
      };
    },
  );
}
