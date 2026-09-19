import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const events = await prisma.securityEvent.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventType: true,
        severity: true,
        status: true,
        description: true,
        sourceIp: true,
        createdAt: true,
      },
    });
    return jsonOk(events);
  } catch (error) {
    return mapAuthError(error);
  }
}
