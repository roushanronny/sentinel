import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(128),
  name: z.string().min(2).max(120),
  organizationName: z.string().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  orgId?: string;
  role?: string;
  sid: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = randomBytes(2).toString('hex');
  return `${base || 'org'}-${suffix}`;
}

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(input: {
  claims: AccessTokenClaims;
  secret: string;
  ttlSeconds: number;
}): Promise<string> {
  return new SignJWT({
    email: input.claims.email,
    orgId: input.claims.orgId,
    role: input.claims.role,
    sid: input.claims.sid,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${input.ttlSeconds}s`)
    .sign(toKey(input.secret));
}

export async function verifyAccessToken(input: {
  token: string;
  secret: string;
}): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(input.token, toKey(input.secret));
  if (!payload.sub || typeof payload.email !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('Invalid access token claims');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    sid: payload.sid,
    orgId: typeof payload.orgId === 'string' ? payload.orgId : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}

export function buildTokenPairMeta(accessTtl: number, refreshTtl: number): {
  accessExpiresIn: number;
  refreshExpiresIn: number;
} {
  return {
    accessExpiresIn: accessTtl,
    refreshExpiresIn: refreshTtl,
  };
}
