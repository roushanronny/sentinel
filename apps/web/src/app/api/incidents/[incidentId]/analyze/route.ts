import { createHash } from 'node:crypto';
import { requireAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { jsonOk, mapAuthError } from '@/lib/server/http';

export const runtime = 'nodejs';

type Params = { params: Promise<{ incidentId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    const { incidentId } = await params;
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, organizationId: auth.organizationId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!incident) throw new Error('NOT_FOUND');

    const analysis = {
      summary: `Heuristic review of “${incident.title}”. Deterministic gateway rules remain primary; this output is advisory only.`,
      observedEvidence: [
        `Incident status ${incident.status} / severity ${incident.severity}`,
        `${incident.events.length} recent timeline events available`,
      ],
      hypotheses: [
        'Abuse or noisy client retries against a protected route',
        'Misconfigured client causing repeated auth failures',
      ],
      recommendedActions: [
        'Review recent security events for the same service',
        'Confirm rate-limit budgets for hot routes',
        'Do not auto-execute remediation from AI output',
      ],
      uncertainty: ['Live gateway telemetry is outside this serverless control-plane path'],
    };

    const inputHash = createHash('sha256')
      .update(`${incidentId}:${incident.updatedAt.toISOString()}`)
      .digest('hex');

    const row = await prisma.aiAnalysis.create({
      data: {
        organizationId: auth.organizationId,
        incidentId,
        model: 'heuristic-v1',
        promptVersion: 'incident-analysis-1',
        inputHash,
        analysis,
        confidence: 0.7,
      },
    });

    await prisma.incidentEvent.create({
      data: {
        incidentId,
        eventType: 'AI_ANALYSIS',
        message: 'Heuristic AI analysis completed inline (read-only)',
        metadata: { analysisId: row.id, readOnly: true },
      },
    });

    return jsonOk({
      status: 'completed_inline',
      analysis: row,
      readOnly: true,
      disclaimer:
        'AI recommendations are advisory only and never execute security actions automatically.',
    });
  } catch (error) {
    return mapAuthError(error);
  }
}
