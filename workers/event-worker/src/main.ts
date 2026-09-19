import { processSecurityEventMessage, workerMeta } from './processor.js';
import { loadEnv } from '@sentinel/config';
import { prisma } from '@sentinel/database';
import { createLogger } from '@sentinel/logger';
import { RabbitMqConsumer } from '@sentinel/messaging';
import { initTelemetry } from '@sentinel/telemetry';

const env = loadEnv();
const logger = createLogger({ service: workerMeta.service, level: env.LOG_LEVEL });
initTelemetry(workerMeta.service);

async function main(): Promise<void> {
  const consumer = new RabbitMqConsumer(env.RABBITMQ_URL);
  await consumer.start(processSecurityEventMessage);
  logger.info({ queue: 'sentinel.security.events.q' }, 'Event worker consuming');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down event worker');
    await consumer.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
