import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ incidentId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    const { incidentId } = await params;
    const body = (await request.json()) as { message?: string };
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, organizationId: auth.organizationId },
    });
    if (!incident) throw new Error('NOT_FOUND');

    const event = await prisma.incidentEvent.create({
      data: {
        incidentId,
        eventType: 'NOTE',
        message: body.message?.trim() || '',
      },
    });
    return jsonOk(event, 201);
  } catch (error) {
    return mapAuthError(error);
  }
}
