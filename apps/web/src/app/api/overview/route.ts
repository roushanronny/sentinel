import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const orgId = auth.organizationId;
    const [services, openEvents, openIncidents, recentSecurityEvents] = await Promise.all([
      prisma.service.count({ where: { organizationId: orgId } }),
      prisma.securityEvent.count({ where: { organizationId: orgId, status: 'OPEN' } }),
      prisma.incident.count({
        where: {
          organizationId: orgId,
          status: { in: ['OPEN', 'INVESTIGATING', 'MITIGATED'] },
        },
      }),
      prisma.securityEvent.findMany({
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
    return jsonOk({ services, openSecurityEvents: openEvents, openIncidents, recentSecurityEvents });
  } catch (error) {
    return mapAuthError(error);
  }
}
