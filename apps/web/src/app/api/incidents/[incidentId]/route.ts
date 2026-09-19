import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ incidentId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    const { incidentId } = await params;
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, organizationId: auth.organizationId },
      include: {
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!incident) throw new Error('NOT_FOUND');
    return jsonOk(incident);
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    const { incidentId } = await params;
    const body = (await request.json()) as { status?: string };
    const existing = await prisma.incident.findFirst({
      where: { id: incidentId, organizationId: auth.organizationId },
    });
    if (!existing) throw new Error('NOT_FOUND');

    const status = body.status as
      | 'OPEN'
      | 'INVESTIGATING'
      | 'MITIGATED'
      | 'RESOLVED'
      | 'CLOSED'
      | undefined;

    const incident = await prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: status ?? existing.status,
          resolvedAt:
            status === 'RESOLVED' || status === 'CLOSED' ? new Date() : existing.resolvedAt,
        },
        include: { events: { orderBy: { createdAt: 'desc' } } },
      });
      if (status) {
        await tx.incidentEvent.create({
          data: {
            incidentId,
            eventType: 'STATUS',
            message: `Status set to ${status}`,
          },
        });
      }
      return updated;
    });

    return jsonOk(incident);
  } catch (error) {
    return mapAuthError(error);
  }
}
