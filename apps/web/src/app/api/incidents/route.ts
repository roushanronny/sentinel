import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const incidents = await prisma.incident.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        service: { select: { id: true, name: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return jsonOk(incidents);
  } catch (error) {
    return mapAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const body = (await request.json()) as {
      title?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description?: string;
    };

    const incident = await prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          organizationId: auth.organizationId,
          title: body.title?.trim() || 'Untitled incident',
          severity: body.severity || 'HIGH',
          description: body.description ?? null,
          status: 'OPEN',
          createdById: auth.userId,
        },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: created.id,
          eventType: 'CREATED',
          message: 'Incident created from dashboard',
        },
      });
      return tx.incident.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          service: { select: { id: true, name: true } },
          _count: { select: { events: true } },
        },
      });
    });

    return jsonOk(incident, 201);
  } catch (error) {
    return mapAuthError(error);
  }
}
