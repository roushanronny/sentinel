import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { prisma } from './db';

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret-min-32-chars!!';
  if (secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
  }
  return secret;
}

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function signAccessToken(input: {
  sub: string;
  email: string;
  sid: string;
  orgId?: string;
  role?: string;
}): Promise<string> {
  return new SignJWT({
    email: input.email,
    orgId: input.orgId,
    role: input.role,
    sid: input.sid,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.sub)
    .setIssuedAt()
    .setExpirationTime('900s')
    .sign(toKey(accessSecret()));
}

export async function verifyAccessToken(token: string): Promise<{
  sub: string;
  email: string;
  sid: string;
  orgId?: string;
  role?: string;
}> {
  const { payload } = await jwtVerify(token, toKey(accessSecret()));
  if (!payload.sub || typeof payload.email !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Invalid access token');
  }
  return {
    sub: payload.sub,
    email: payload.email,
    sid: payload.sid,
    orgId: typeof payload.orgId === 'string' ? payload.orgId : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}

export async function loginUser(email: string, password: string, meta?: { ip?: string; ua?: string }) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      memberships: {
        include: { organization: true },
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new Error('INVALID_CREDENTIALS');
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const membership = user.memberships[0] ?? null;
  const refreshToken = createOpaqueToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      organizationId: membership?.organizationId,
      refreshTokenHash: hashOpaqueToken(refreshToken),
      userAgent: meta?.ua,
      ipAddress: meta?.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    sid: session.id,
    orgId: membership?.organizationId,
    role: membership?.role,
  });

  await prisma.auditLog.create({
    data: {
      organizationId: membership?.organizationId,
      userId: user.id,
      action: 'USER_LOGIN',
      resourceType: 'session',
      resourceId: session.id,
      ipAddress: meta?.ip,
    },
  });

  return {
    tokens: {
      accessToken,
      refreshToken,
      accessExpiresIn: 900,
      refreshExpiresIn: 604800,
    },
    user: { id: user.id, email: user.email, name: user.name },
    organization: membership
      ? {
          id: membership.organization.id,
          name: membership.organization.name,
          role: membership.role,
        }
      : null,
  };
}

export async function requireAuth(request: Request): Promise<{
  userId: string;
  organizationId: string;
  role: string;
}> {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const claims = await verifyAccessToken(token);
  const session = await prisma.session.findUnique({ where: { id: claims.sid } });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    throw new Error('UNAUTHORIZED');
  }

  const orgHeader = request.headers.get('x-organization-id');
  const organizationId = orgHeader || claims.orgId;
  if (!organizationId) {
    throw new Error('ORG_REQUIRED');
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: claims.sub,
      },
    },
  });
  if (!membership) {
    throw new Error('FORBIDDEN');
  }

  return { userId: claims.sub, organizationId, role: membership.role };
}
