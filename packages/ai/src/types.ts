import { z } from 'zod';

export const PROMPT_VERSION = 'incident-analysis-v1';

export const analysisResultSchema = z.object({
  summary: z.string().min(1),
  observedEvidence: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  uncertainty: z.array(z.string()).default([]),
  refusedUnsupportedConclusions: z.boolean().default(true),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export interface SanitizedIncidentContext {
  incident: {
    id: string;
    title: string;
    description?: string | null;
    severity: string;
    status: string;
  };
  timeline: Array<{
    eventType: string;
    message: string;
    createdAt: string;
  }>;
  securityEvents: Array<{
    eventType: string;
    severity: string;
    description: string;
    sourceIp?: string | null;
    createdAt: string;
  }>;
  metricsHints: Array<string>;
}

export interface AiProvider {
  readonly name: string;
  analyzeIncident(context: SanitizedIncidentContext): Promise<AnalysisResult>;
}

export function createEmptyAnalysis(reason: string): AnalysisResult {
  return {
    summary: reason,
    observedEvidence: [],
    hypotheses: [],
    recommendedActions: ['Gather additional telemetry before concluding root cause.'],
    confidence: 0.2,
    uncertainty: [reason],
    refusedUnsupportedConclusions: true,
  };
}
