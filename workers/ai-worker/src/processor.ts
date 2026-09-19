import { createHash } from 'node:crypto';
import {
  processAiAnalysisJob,
} from '@sentinel/ai';
import type { PrismaClient } from '@sentinel/database';
import type { AiAnalysisMessage } from '@sentinel/messaging';

export async function processAiAnalysisMessage(
  db: PrismaClient,
  message: AiAnalysisMessage,
  env: {
    AI_PROVIDER?: string;
    AI_API_KEY?: string;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
  },
): Promise<string> {
  const result = await processAiAnalysisJob(
    db,
    {
      idempotencyKey: message.idempotencyKey,
      organizationId: message.organizationId,
      incidentId: message.incidentId,
    },
    env,
  );
  return result.analysisId;
}

export function buildAiIdempotencyKey(incidentId: string, userId: string): string {
  return createHash('sha256')
    .update(`ai:${incidentId}:${userId}:${Math.floor(Date.now() / 60_000)}`)
    .digest('hex');
}
