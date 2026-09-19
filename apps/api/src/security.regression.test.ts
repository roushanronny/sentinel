import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { hashPassword } from '@sentinel/auth';
import { PrismaClient } from '@sentinel/database';
import { buildApiApp } from './app.js';

const db = new PrismaClient();
const runId = createHash('sha1').update(`api-${Date.now()}`).digest('hex').slice(0, 8);

describe('api security regressions', () => {
  const userIds: string[] = [];
  const orgIds: string[] = [];

  afterAll(async () => {
    for (const userId of userIds) {
      await db.session.deleteMany({ where: { userId } });
      await db.organizationMember.deleteMany({ where: { userId } });
      await db.auditLog.deleteMany({ where: { userId } });
      await db.incident.deleteMany({ where: { createdById: userId } });
      await db.user.deleteMany({ where: { id: userId } });
    }
    for (const orgId of orgIds) {
      await db.securityEvent.deleteMany({ where: { organizationId: orgId } });
      await db.apiKey.deleteMany({ where: { organizationId: orgId } });
      await db.service.deleteMany({ where: { organizationId: orgId } });
      await db.organization.deleteMany({ where: { id: orgId } });
    }
    await db.$disconnect();
  });

  it('enforces tenant isolation for services', async () => {
    const passwordHash = await hashPassword('Tenant-Isolation-Pass1');
    const orgA = await db.organization.create({
      data: { name: `Org A ${runId}`, slug: `org-a-${runId}` },
    });
    const orgB = await db.organization.create({
      data: { name: `Org B ${runId}`, slug: `org-b-${runId}` },
    });
    orgIds.push(orgA.id, orgB.id);

    const userA = await db.user.create({
      data: { email: `a-${runId}@example.com`, name: 'Tenant A', passwordHash },
    });
    userIds.push(userA.id);
    await db.organizationMember.create({
      data: { organizationId: orgA.id, userId: userA.id, role: 'OWNER' },
    });
    const serviceB = await db.service.create({
      data: {
        organizationId: orgB.id,
        name: `orders-${runId}`,
        upstreamUrl: 'http://localhost:3002',
      },
    });

    const { app } = buildApiApp({ db });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: userA.email, password: 'Tenant-Isolation-Pass1' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.tokens.accessToken as string;

    const forbidden = await app.inject({
      method: 'GET',
      url: `/services/${serviceB.id}`,
      headers: { authorization: `Bearer ${token}`, 'x-organization-id': orgA.id },
    });
    expect(forbidden.statusCode).toBe(404);

    const crossTenant = await app.inject({
      method: 'GET',
      url: '/services',
      headers: { authorization: `Bearer ${token}`, 'x-organization-id': orgB.id },
    });
    expect(crossTenant.statusCode).toBe(403);
    await app.close();
  });

  it('denies VIEWER service creation', async () => {
    const passwordHash = await hashPassword('Viewer-Pass-12345');
    const org = await db.organization.create({
      data: { name: `Viewer Org ${runId}`, slug: `viewer-${runId}` },
    });
    orgIds.push(org.id);
    const viewer = await db.user.create({
      data: { email: `viewer-${runId}@example.com`, name: 'Viewer', passwordHash },
    });
    userIds.push(viewer.id);
    await db.organizationMember.create({
      data: { organizationId: org.id, userId: viewer.id, role: 'VIEWER' },
    });

    const { app } = buildApiApp({ db });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: viewer.email, password: 'Viewer-Pass-12345' },
    });
    const token = login.json().data.tokens.accessToken as string;
    const create = await app.inject({
      method: 'POST',
      url: '/services',
      headers: { authorization: `Bearer ${token}`, 'x-organization-id': org.id },
      payload: { name: 'blocked-service', upstreamUrl: 'http://localhost:3002' },
    });
    expect(create.statusCode).toBe(403);
    await app.close();
  });

  it('rejects revoked sessions on /auth/me', async () => {
    const passwordHash = await hashPassword('Revoke-Pass-12345');
    const org = await db.organization.create({
      data: { name: `Revoke Org ${runId}`, slug: `revoke-${runId}` },
    });
    orgIds.push(org.id);
    const user = await db.user.create({
      data: { email: `revoke-${runId}@example.com`, name: 'Revoke', passwordHash },
    });
    userIds.push(user.id);
    await db.organizationMember.create({
      data: { organizationId: org.id, userId: user.id, role: 'ENGINEER' },
    });

    const { app } = buildApiApp({ db });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: user.email, password: 'Revoke-Pass-12345' },
    });
    const accessToken = login.json().data.tokens.accessToken as string;
    const refreshToken = login.json().data.tokens.refreshToken as string;
    await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken } });
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(401);
    await app.close();
  });
});
