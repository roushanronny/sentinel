import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
      },
    });
    return jsonOk(logs);
  } catch (error) {
    return mapAuthError(error);
  }
}
