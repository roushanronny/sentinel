import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenClaims } from '@sentinel/auth';
import type { PrismaClient, OrganizationRole } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { assertPermission, type Permission, AuthorizationError } from '@sentinel/security';

export interface AuthContext {
  userId: string;
  email: string;
  sessionId: string;
  organizationId: string;
  role: OrganizationRole;
  claims: AccessTokenClaims;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function getBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function createRequireAuth(deps: { env: Env; db: PrismaClient }) {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      await reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token', requestId: request.id },
      });
      return;
    }

    try {
      const claims = await verifyAccessToken({
        token,
        secret: deps.env.JWT_ACCESS_SECRET,
      });

      const session = await deps.db.session.findUnique({ where: { id: claims.sid } });
      if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        await reply.code(401).send({
          error: {
            code: 'SESSION_REVOKED',
            message: 'Session is no longer valid',
            requestId: request.id,
          },
        });
        return;
      }

      const headerOrgId = request.headers['x-organization-id'];
      const requestedOrgId =
        (typeof headerOrgId === 'string' ? headerOrgId : undefined) ?? claims.orgId;

      if (!requestedOrgId) {
        await reply.code(400).send({
          error: {
            code: 'ORG_REQUIRED',
            message: 'Organization context is required',
            requestId: request.id,
          },
        });
        return;
      }

      const membership = await deps.db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: requestedOrgId,
            userId: claims.sub,
          },
        },
      });

      if (!membership) {
        await reply.code(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Not a member of this organization',
            requestId: request.id,
          },
        });
        return;
      }

      request.auth = {
        userId: claims.sub,
        email: claims.email,
        sessionId: claims.sid,
        organizationId: membership.organizationId,
        role: membership.role,
        claims,
      };
    } catch {
      await reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Invalid access token', requestId: request.id },
      });
    }
  };
}

export function requirePermission(permission: Permission) {
  return async function permissionGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth) {
      await reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId: request.id },
      });
      return;
    }

    try {
      assertPermission(request.auth.role, permission);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        await reply.code(403).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
        return;
      }
      throw error;
    }
  };
}
