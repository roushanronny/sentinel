import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const services = await prisma.service.findMany({
      where: { organizationId: auth.organizationId },
      include: { _count: { select: { routes: true } } },
      orderBy: { name: 'asc' },
    });
    return jsonOk(services);
  } catch (error) {
    return mapAuthError(error);
  }
}
