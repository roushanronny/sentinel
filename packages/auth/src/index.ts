import type { PrismaClient, OrganizationRole } from '@sentinel/database';
import {
  buildTokenPairMeta,
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  loginSchema,
  registerSchema,
  signAccessToken,
  slugifyOrganizationName,
  verifyPassword,
  type LoginInput,
  type RegisterInput,
  type TokenPair,
} from './crypto.js';

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly config: AuthConfig,
  ) {}

  async register(input: RegisterInput): Promise<{ userId: string; organizationId: string }> {
    const data = registerSchema.parse(input);
    const existing = await this.db.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) {
      throw new AuthError('EMAIL_IN_USE', 'An account with this email already exists');
    }

    const passwordHash = await hashPassword(data.password);
    const slug = slugifyOrganizationName(data.organizationName);

    const result = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          name: data.name,
          passwordHash,
          status: 'ACTIVE',
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
          status: 'ACTIVE',
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: 'USER_REGISTERED',
          resourceType: 'user',
          resourceId: user.id,
          metadata: { email: user.email },
        },
      });

      return { userId: user.id, organizationId: organization.id };
    });

    return result;
  }

  async login(input: LoginInput & { userAgent?: string; ipAddress?: string }): Promise<{
    tokens: TokenPair;
    user: { id: string; email: string; name: string };
    organization: { id: string; name: string; role: OrganizationRole } | null;
  }> {
    const data = loginSchema.parse(input);
    const user = await this.db.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const valid = await verifyPassword(user.passwordHash, data.password);
    if (!valid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const membership = user.memberships[0] ?? null;
    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashOpaqueToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.config.refreshTtlSeconds * 1000);

    const session = await this.db.session.create({
      data: {
        userId: user.id,
        organizationId: membership?.organizationId,
        refreshTokenHash,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        expiresAt,
      },
    });

    const accessToken = await signAccessToken({
      secret: this.config.accessSecret,
      ttlSeconds: this.config.accessTtlSeconds,
      claims: {
        sub: user.id,
        email: user.email,
        sid: session.id,
        orgId: membership?.organizationId,
        role: membership?.role,
      },
    });

    await this.db.auditLog.create({
      data: {
        organizationId: membership?.organizationId,
        userId: user.id,
        action: 'USER_LOGIN',
        resourceType: 'session',
        resourceId: session.id,
        ipAddress: input.ipAddress,
      },
    });

    const meta = buildTokenPairMeta(this.config.accessTtlSeconds, this.config.refreshTtlSeconds);

    return {
      tokens: {
        accessToken,
        refreshToken,
        ...meta,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: membership
        ? {
            id: membership.organization.id,
            name: membership.organization.name,
            role: membership.role,
          }
        : null,
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const refreshTokenHash = hashOpaqueToken(refreshToken);
    const session = await this.db.session.findFirst({
      where: { refreshTokenHash },
      include: {
        user: {
          include: {
            memberships: {
              include: { organization: true },
              take: 1,
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new AuthError('USER_DISABLED', 'User account is disabled');
    }

    const membership = session.user.memberships[0] ?? null;
    const nextRefreshToken = createOpaqueToken();
    const nextHash = hashOpaqueToken(nextRefreshToken);
    const expiresAt = new Date(Date.now() + this.config.refreshTtlSeconds * 1000);

    await this.db.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: nextHash,
        expiresAt,
      },
    });

    const accessToken = await signAccessToken({
      secret: this.config.accessSecret,
      ttlSeconds: this.config.accessTtlSeconds,
      claims: {
        sub: session.user.id,
        email: session.user.email,
        sid: session.id,
        orgId: membership?.organizationId,
        role: membership?.role,
      },
    });

    const meta = buildTokenPairMeta(this.config.accessTtlSeconds, this.config.refreshTtlSeconds);
    return {
      accessToken,
      refreshToken: nextRefreshToken,
      ...meta,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = hashOpaqueToken(refreshToken);
    const session = await this.db.session.findFirst({ where: { refreshTokenHash } });
    if (!session || session.revokedAt) {
      return;
    }

    await this.db.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.db.auditLog.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        action: 'USER_LOGOUT',
        resourceType: 'session',
        resourceId: session.id,
      },
    });
  }

  async getMe(userId: string): Promise<{
    id: string;
    email: string;
    name: string;
    status: string;
    organizations: Array<{ id: string; name: string; slug: string; role: OrganizationRole }>;
  }> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      organizations: user.memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
      })),
    };
  }
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export * from './crypto.js';
