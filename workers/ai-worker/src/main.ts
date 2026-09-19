import { loadEnv } from '@sentinel/config';
import { prisma } from '@sentinel/database';
import { createLogger } from '@sentinel/logger';
import { RabbitMqAiConsumer } from '@sentinel/messaging';
import { initTelemetry } from '@sentinel/telemetry';
import { processAiAnalysisMessage } from './processor.js';

const env = loadEnv();
const logger = createLogger({ service: 'sentinel-ai-worker', level: env.LOG_LEVEL });
initTelemetry('sentinel-ai-worker');

async function main(): Promise<void> {
  const consumer = new RabbitMqAiConsumer(env.RABBITMQ_URL);
  await consumer.start(async (message) => {
    const analysisId = await processAiAnalysisMessage(prisma, message, env);
    logger.info(
      {
        analysisId,
        incidentId: message.incidentId,
        organizationId: message.organizationId,
      },
      'AI analysis stored',
    );
  });

  logger.info({ queue: 'sentinel.ai.analysis.q' }, 'AI worker consuming');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down AI worker');
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
