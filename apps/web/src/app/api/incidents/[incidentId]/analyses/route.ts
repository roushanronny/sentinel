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
    });
    if (!incident) throw new Error('NOT_FOUND');

    const analyses = await prisma.aiAnalysis.findMany({
      where: { organizationId: auth.organizationId, incidentId },
      orderBy: { createdAt: 'desc' },
    });

    return jsonOk(
      analyses.map((row) => ({
        ...row,
        readOnly: true,
        disclaimer:
          'AI recommendations are advisory only and never execute security actions automatically.',
      })),
    );
  } catch (error) {
    return mapAuthError(error);
  }
}
