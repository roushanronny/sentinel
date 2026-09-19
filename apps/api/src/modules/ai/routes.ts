import type { FastifyInstance } from 'fastify';
import { buildAiIdempotencyKey, processAiAnalysisJob } from '@sentinel/ai';
import type { PrismaClient } from '@sentinel/database';
import type { Env } from '@sentinel/config';
import { RabbitMqPublisher } from '@sentinel/messaging';
import { createRequireAuth, requirePermission } from '../../plugins/auth-guard.js';

export async function registerAiRoutes(
  app: FastifyInstance,
  deps: { db: PrismaClient; env: Env },
): Promise<void> {
  const requireAuth = createRequireAuth(deps);

  app.get(
    '/incidents/:incidentId/analyses',
    { preHandler: [requireAuth, requirePermission('incidents:read')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { incidentId } = request.params as { incidentId: string };

      const incident = await deps.db.incident.findFirst({
        where: { id: incidentId, organizationId: auth.organizationId },
      });
      if (!incident) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Incident not found', requestId: request.id },
        });
      }

      const analyses = await deps.db.aiAnalysis.findMany({
        where: { organizationId: auth.organizationId, incidentId },
        orderBy: { createdAt: 'desc' },
      });

      return {
        data: analyses.map((row) => ({
          ...row,
          readOnly: true,
          disclaimer:
            'AI recommendations are advisory only and never execute security actions automatically.',
        })),
      };
    },
  );

  app.post(
    '/incidents/:incidentId/analyze',
    { preHandler: [requireAuth, requirePermission('incidents:write')] },
    async (request, reply) => {
      const auth = request.auth!;
      const { incidentId } = request.params as { incidentId: string };

      const incident = await deps.db.incident.findFirst({
        where: { id: incidentId, organizationId: auth.organizationId },
      });
      if (!incident) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Incident not found', requestId: request.id },
        });
      }

      const idempotencyKey = buildAiIdempotencyKey(incidentId, auth.userId);
      const message = {
        idempotencyKey,
        organizationId: auth.organizationId,
        incidentId,
        requestedByUserId: auth.userId,
        requestedAt: new Date().toISOString(),
      };

      try {
        const publisher = new RabbitMqPublisher(deps.env.RABBITMQ_URL);
        await publisher.connect();
        await publisher.publishAiAnalysis(message);
        await publisher.close();

        await deps.db.incidentEvent.create({
          data: {
            incidentId,
            eventType: 'AI_ANALYSIS_QUEUED',
            message: 'AI analysis queued for asynchronous processing',
            metadata: { idempotencyKey, readOnly: true },
          },
        });

        return reply.code(202).send({
          data: {
            status: 'queued',
            idempotencyKey,
            readOnly: true,
          },
        });
      } catch {
        const result = await processAiAnalysisJob(
          deps.db,
          {
            idempotencyKey,
            organizationId: auth.organizationId,
            incidentId,
          },
          deps.env,
        );

        const analysis = await deps.db.aiAnalysis.findUnique({ where: { id: result.analysisId } });
        return reply.code(200).send({
          data: {
            status: 'completed_inline',
            analysis,
            readOnly: true,
            disclaimer:
              'AI recommendations are advisory only and never execute security actions automatically.',
          },
        });
      }
    },
  );
}
