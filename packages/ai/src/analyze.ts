import { createHash } from 'node:crypto';
import type { AnalysisResult, SanitizedIncidentContext } from './types.js';
import { PROMPT_VERSION } from './types.js';
import { createAiProvider } from './provider.js';
import { assertNoSecrets, redactUnknown } from './redact.js';

export function hashContext(context: SanitizedIncidentContext): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex');
}

export async function analyzeSanitizedIncident(
  context: SanitizedIncidentContext,
  env: {
    AI_PROVIDER?: string;
    AI_API_KEY?: string;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
  } = {},
): Promise<{ model: string; promptVersion: string; inputHash: string; analysis: AnalysisResult }> {
  const sanitized = redactUnknown(context) as SanitizedIncidentContext;
  assertNoSecrets(sanitized);
  const provider = createAiProvider(env);
  const analysis = await provider.analyzeIncident(sanitized);
  return {
    model: provider.name,
    promptVersion: PROMPT_VERSION,
    inputHash: hashContext(sanitized),
    analysis,
  };
}
