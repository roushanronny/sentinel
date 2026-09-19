import type { PrismaClient } from '@sentinel/database';
import { analyzeSanitizedIncident } from './analyze.js';
import type { SanitizedIncidentContext } from './types.js';
import { createHash } from 'node:crypto';

export async function buildIncidentContext(
  db: PrismaClient,
  organizationId: string,
  incidentId: string,
): Promise<SanitizedIncidentContext> {
  const incident = await db.incident.findFirst({
    where: { id: incidentId, organizationId },
    include: {
      events: { orderBy: { createdAt: 'asc' }, take: 50 },
    },
  });

  if (!incident) {
    throw new Error('Incident not found for AI analysis');
  }

  const securityEvents = await db.securityEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return {
    incident: {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      status: incident.status,
    },
    timeline: incident.events.map((event) => ({
      eventType: event.eventType,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    })),
    securityEvents: securityEvents.map((event) => ({
      eventType: event.eventType,
      severity: event.severity,
      description: event.description,
      sourceIp: event.sourceIp,
      createdAt: event.createdAt.toISOString(),
    })),
    metricsHints: deriveMetricHints(securityEvents.map((event) => event.eventType)),
  };
}

function deriveMetricHints(eventTypes: string[]): string[] {
  const hints: string[] = [];
  const authCount = eventTypes.filter((type) => type === 'AUTH_FAILURE').length;
  const rateCount = eventTypes.filter((type) => type === 'RATE_LIMIT_EXCEEDED').length;
  const upstreamCount = eventTypes.filter(
    (type) => type === 'UPSTREAM_TIMEOUT' || type === 'UPSTREAM_ERROR',
  ).length;
  if (authCount > 0) hints.push(`Recent AUTH_FAILURE count in sample: ${authCount}`);
  if (rateCount > 0) hints.push(`Recent RATE_LIMIT_EXCEEDED count in sample: ${rateCount}`);
  if (upstreamCount > 0) hints.push(`Recent upstream failure count in sample: ${upstreamCount}`);
  return hints;
}

export async function processAiAnalysisJob(
  db: PrismaClient,
  input: {
    idempotencyKey: string;
    organizationId: string;
    incidentId: string;
  },
  env: {
    AI_PROVIDER?: string;
    AI_API_KEY?: string;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
  },
): Promise<{ analysisId: string; queuedDuplicate: boolean }> {
  const existing = await db.processedMessage.findUnique({ where: { id: input.idempotencyKey } });
  if (existing) {
    const prior = await db.aiAnalysis.findFirst({
      where: { organizationId: input.organizationId, incidentId: input.incidentId },
      orderBy: { createdAt: 'desc' },
    });
    return { analysisId: prior?.id ?? existing.id, queuedDuplicate: true };
  }

  const context = await buildIncidentContext(db, input.organizationId, input.incidentId);
  const result = await analyzeSanitizedIncident(context, env);

  const analysis = await db.$transaction(async (tx) => {
    const created = await tx.aiAnalysis.create({
      data: {
        organizationId: input.organizationId,
        incidentId: input.incidentId,
        model: result.model,
        promptVersion: result.promptVersion,
        inputHash: result.inputHash,
        analysis: result.analysis,
        confidence: result.analysis.confidence,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: input.incidentId,
        eventType: 'AI_ANALYSIS_COMPLETED',
        message: `AI analysis completed with confidence ${result.analysis.confidence.toFixed(2)}`,
        metadata: {
          analysisId: created.id,
          model: result.model,
          readOnly: true,
        },
      },
    });

    await tx.processedMessage.create({
      data: {
        id: input.idempotencyKey,
        queue: 'sentinel.ai.analysis.q',
      },
    });

    return created;
  });

  return { analysisId: analysis.id, queuedDuplicate: false };
}

export function buildAiIdempotencyKey(incidentId: string, userId: string): string {
  return createHash('sha256')
    .update(`ai:${incidentId}:${userId}:${Math.floor(Date.now() / 60_000)}`)
    .digest('hex');
}
