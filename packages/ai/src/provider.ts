import {
  analysisResultSchema,
  createEmptyAnalysis,
  type AiProvider,
  type AnalysisResult,
  type SanitizedIncidentContext,
} from './types.js';
import { HeuristicIncidentAnalyzer } from './heuristic.js';
import { redactUnknown, assertNoSecrets } from './redact.js';

export interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Optional OpenAI-compatible provider. Falls back to heuristic analyzer on failure.
 */
export class OpenAiCompatibleAnalyzer implements AiProvider {
  readonly name: string;
  private readonly fallback = new HeuristicIncidentAnalyzer();

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.name = config.model ?? 'openai-compatible';
  }

  async analyzeIncident(context: SanitizedIncidentContext): Promise<AnalysisResult> {
    const sanitized = redactUnknown(context);
    assertNoSecrets(sanitized);

    const baseUrl = (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = this.config.model ?? 'gpt-4o-mini';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a security incident analysis assistant. Use only provided evidence. Separate facts from hypotheses. Never invent metrics. Never request or echo secrets. Return JSON with keys: summary, observedEvidence, hypotheses, recommendedActions, confidence, uncertainty, refusedUnsupportedConclusions.',
            },
            {
              role: 'user',
              content: JSON.stringify(sanitized),
            },
          ],
        }),
      });

      if (!response.ok) {
        return this.fallback.analyzeIncident(context);
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        return this.fallback.analyzeIncident(context);
      }

      const parsed = analysisResultSchema.safeParse(JSON.parse(content));
      if (!parsed.success) {
        return this.fallback.analyzeIncident(context);
      }
      return parsed.data;
    } catch {
      return createEmptyAnalysis('External AI provider failed; no unsupported conclusion emitted.');
    }
  }
}

export function createAiProvider(env: {
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}): AiProvider {
  if (env.AI_PROVIDER === 'openai' && env.AI_API_KEY) {
    return new OpenAiCompatibleAnalyzer({
      apiKey: env.AI_API_KEY,
      baseUrl: env.AI_BASE_URL,
      model: env.AI_MODEL,
    });
  }
  return new HeuristicIncidentAnalyzer();
}
