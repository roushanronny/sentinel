import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaClient, OrganizationRole, HttpMethod } from '@prisma/client';

const prisma = new PrismaClient();

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

const DEMO_PASSWORD = 'ChangeMe-Demo-Pass1';

async function main(): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-demo' },
    update: {},
    create: {
      name: 'Acme Demo',
      slug: 'acme-demo',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@acme.demo' },
    update: { passwordHash },
    create: {
      email: 'admin@acme.demo',
      name: 'Acme Admin',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@acme.demo' },
    update: { passwordHash },
    create: {
      email: 'engineer@acme.demo',
      name: 'Acme Engineer',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@acme.demo' },
    update: { passwordHash },
    create: {
      email: 'viewer@acme.demo',
      name: 'Acme Viewer',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  const memberships: Array<{ userId: string; role: OrganizationRole }> = [
    { userId: admin.id, role: 'OWNER' },
    { userId: engineer.id, role: 'ENGINEER' },
    { userId: viewer.id, role: 'VIEWER' },
  ];

  for (const membership of memberships) {
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: membership.userId,
        },
      },
      update: { role: membership.role },
      create: {
        organizationId: org.id,
        userId: membership.userId,
        role: membership.role,
      },
    });
  }

  const usersApi = await prisma.service.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: 'users-api',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'users-api',
      description: 'Demo users upstream',
      environment: 'development',
      upstreamUrl: 'http://localhost:3002',
      status: 'ACTIVE',
    },
  });

  const ordersApi = await prisma.service.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: 'orders-api',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'orders-api',
      description: 'Demo orders upstream',
      environment: 'development',
      upstreamUrl: 'http://localhost:3002',
      status: 'ACTIVE',
    },
  });

  const routes: Array<{
    serviceId: string;
    path: string;
    method: HttpMethod;
    rateLimitRpm: number;
    authRequired: boolean;
  }> = [
    { serviceId: usersApi.id, path: '/users', method: 'GET', rateLimitRpm: 120, authRequired: false },
    { serviceId: usersApi.id, path: '/users/:id', method: 'GET', rateLimitRpm: 120, authRequired: false },
    { serviceId: ordersApi.id, path: '/orders', method: 'GET', rateLimitRpm: 100, authRequired: false },
    { serviceId: ordersApi.id, path: '/orders/:id', method: 'GET', rateLimitRpm: 100, authRequired: false },
    { serviceId: ordersApi.id, path: '/orders', method: 'POST', rateLimitRpm: 30, authRequired: true },
  ];

  for (const route of routes) {
    await prisma.apiRoute.upsert({
      where: {
        serviceId_method_path: {
          serviceId: route.serviceId,
          method: route.method,
          path: route.path,
        },
      },
      update: {
        rateLimitRpm: route.rateLimitRpm,
        authRequired: route.authRequired,
      },
      create: {
        serviceId: route.serviceId,
        path: route.path,
        method: route.method,
        authRequired: route.authRequired,
        rateLimitRpm: route.rateLimitRpm,
      },
    });
  }

  const existingKey = await prisma.apiKey.findFirst({
    where: { organizationId: org.id, name: 'Demo dashboard key', revokedAt: null },
  });

  if (!existingKey) {
    const rawKey = `sen_demo_${randomBytes(16).toString('hex')}`;
    await prisma.apiKey.create({
      data: {
        organizationId: org.id,
        name: 'Demo dashboard key',
        keyPrefix: rawKey.slice(0, 12),
        keyHash: hashToken(rawKey),
      },
    });
  }

  const existingEvents = await prisma.securityEvent.count({
    where: { organizationId: org.id },
  });

  if (existingEvents === 0) {
    await prisma.securityEvent.createMany({
      data: [
        {
          organizationId: org.id,
          serviceId: usersApi.id,
          eventType: 'AUTH_FAILURE',
          severity: 'MEDIUM',
          sourceIp: '203.0.113.10',
          description: 'Missing authorization header for protected route',
          status: 'OPEN',
        },
        {
          organizationId: org.id,
          serviceId: ordersApi.id,
          eventType: 'RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
          sourceIp: '198.51.100.24',
          description: 'Rate limit exceeded for route GET /orders',
          status: 'OPEN',
        },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete for Acme Demo organization');
  // eslint-disable-next-line no-console
  console.log('Users: admin@acme.demo / engineer@acme.demo / viewer@acme.demo');
  // eslint-disable-next-line no-console
  console.log(`Demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
