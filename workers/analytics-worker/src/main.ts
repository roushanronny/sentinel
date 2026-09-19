import { loadEnv } from '@sentinel/config';
import { createLogger } from '@sentinel/logger';
import { SECURITY_EVENTS_ANALYTICS_QUEUE, RabbitMqConsumer } from '@sentinel/messaging';
import { initTelemetry } from '@sentinel/telemetry';

const env = loadEnv();
const logger = createLogger({ service: 'sentinel-analytics-worker', level: env.LOG_LEVEL });
initTelemetry('sentinel-analytics-worker');

async function main(): Promise<void> {
  const consumer = new RabbitMqConsumer(env.RABBITMQ_URL, SECURITY_EVENTS_ANALYTICS_QUEUE);
  await consumer.start(async (message) => {
    logger.info(
      {
        eventType: message.eventType,
        severity: message.severity,
        organizationId: message.organizationId,
      },
      'Analytics worker observed security event',
    );
  });
  logger.info('Analytics worker consuming security events');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down analytics worker');
    await consumer.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
