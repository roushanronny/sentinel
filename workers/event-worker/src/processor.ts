import { loadEnv } from '@sentinel/config';
import { prisma } from '@sentinel/database';
import { createLogger } from '@sentinel/logger';
import { initTelemetry, withSpan } from '@sentinel/telemetry';
import type { SecurityEventMessage } from '@sentinel/messaging';

const env = loadEnv();
const logger = createLogger({ service: 'sentinel-event-worker', level: env.LOG_LEVEL });
const { tracer } = initTelemetry('sentinel-event-worker');

export const workerMeta = {
  service: 'sentinel-event-worker',
  version: '0.1.0',
};

export async function processSecurityEventMessage(message: SecurityEventMessage): Promise<void> {
  await withSpan(
    tracer,
    'worker.security_event.process',
    {
      'messaging.system': 'rabbitmq',
      'event.type': message.eventType,
      'tenant.id': message.organizationId,
    },
    async () => {
      const existing = await prisma.processedMessage.findUnique({
        where: { id: message.idempotencyKey },
      });
      if (existing) {
        logger.info({ idempotencyKey: message.idempotencyKey }, 'Skipping duplicate message');
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.securityEvent.create({
          data: {
            organizationId: message.organizationId,
            serviceId: message.serviceId,
            eventType: message.eventType,
            severity: message.severity,
            sourceIp: message.sourceIp,
            requestId: message.requestId,
            description: message.description,
            metadata: message.metadata ? (message.metadata as object) : undefined,
          },
        });

        await tx.processedMessage.create({
          data: {
            id: message.idempotencyKey,
            queue: 'sentinel.security.events.q',
          },
        });
      });

      logger.info(
        {
          eventType: message.eventType,
          organizationId: message.organizationId,
          requestId: message.requestId,
        },
        'Persisted security event from queue',
      );
    },
  );
}

// Silence unused in library mode when env loaded for side effects in tests.
void env;
