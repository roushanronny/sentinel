import type { FastifyInstance } from 'fastify';
import { AuthError, AuthService, loginSchema, registerSchema } from '@sentinel/auth';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { verifyAccessToken } from '@sentinel/auth';

function getBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: { auth: AuthService; env: Env; db: PrismaClient },
): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration payload',
          details: parsed.error.flatten(),
          requestId: request.id,
        },
      });
    }

    try {
      const result = await deps.auth.register(parsed.data);
      return reply.code(201).send({ data: result });
    } catch (error) {
      if (error instanceof AuthError && error.code === 'EMAIL_IN_USE') {
        return reply.code(409).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login payload',
          details: parsed.error.flatten(),
          requestId: request.id,
        },
      });
    }

    try {
      const result = await deps.auth.login({
        ...parsed.data,
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });
      return reply.send({ data: result });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(401).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const body = request.body as { refreshToken?: string } | null;
    if (!body?.refreshToken) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'refreshToken is required',
          requestId: request.id,
        },
      });
    }

    try {
      const tokens = await deps.auth.refresh(body.refreshToken);
      return reply.send({ data: { tokens } });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(401).send({
          error: { code: error.code, message: error.message, requestId: request.id },
        });
      }
      throw error;
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = request.body as { refreshToken?: string } | null;
    if (!body?.refreshToken) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'refreshToken is required',
          requestId: request.id,
        },
      });
    }

    await deps.auth.logout(body.refreshToken);
    return reply.code(204).send();
  });

  app.get('/auth/me', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token', requestId: request.id },
      });
    }

    try {
      const claims = await verifyAccessToken({
        token,
        secret: deps.env.JWT_ACCESS_SECRET,
      });

      const session = await deps.db.session.findUnique({ where: { id: claims.sid } });
      if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        return reply.code(401).send({
          error: {
            code: 'SESSION_REVOKED',
            message: 'Session is no longer valid',
            requestId: request.id,
          },
        });
      }

      const me = await deps.auth.getMe(claims.sub);
      return reply.send({ data: me });
    } catch {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Invalid access token', requestId: request.id },
      });
    }
  });
}
