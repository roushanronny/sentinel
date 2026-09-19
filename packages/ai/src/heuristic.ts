import {
  analysisResultSchema,
  createEmptyAnalysis,
  type AiProvider,
  type AnalysisResult,
  type SanitizedIncidentContext,
} from './types.js';

/**
 * Deterministic local analyzer used when no external model is configured.
 * It only reasons over structured evidence already present in the sanitized context.
 */
export class HeuristicIncidentAnalyzer implements AiProvider {
  readonly name = 'heuristic-v1';

  async analyzeIncident(context: SanitizedIncidentContext): Promise<AnalysisResult> {
    const evidence: string[] = [];
    const hypotheses: string[] = [];
    const actions: string[] = [];
    const uncertainty: string[] = [];

    for (const event of context.securityEvents) {
      evidence.push(`${event.eventType} (${event.severity}): ${event.description}`);
    }
    for (const item of context.timeline) {
      evidence.push(`Timeline ${item.eventType}: ${item.message}`);
    }
    for (const hint of context.metricsHints) {
      evidence.push(`Metric hint: ${hint}`);
    }

    const types = new Set(context.securityEvents.map((event) => event.eventType));
    const hasAuthFailure = types.has('AUTH_FAILURE') || types.has('INVALID_TOKEN');
    const hasRateLimit = types.has('RATE_LIMIT_EXCEEDED');
    const hasUpstream = types.has('UPSTREAM_TIMEOUT') || types.has('UPSTREAM_ERROR');
    const mentionsDeploy = context.timeline.some((item) =>
      /deploy/i.test(item.message),
    );

    if (hasAuthFailure && hasRateLimit) {
      hypotheses.push(
        'Automated authentication abuse (credential stuffing / brute force) is a plausible hypothesis.',
      );
      actions.push('Temporarily tighten login route rate limits and review top source IPs.');
      actions.push('Confirm whether credentials were rotated and whether MFA challenges increased.');
    } else if (hasAuthFailure) {
      hypotheses.push('Authentication failures may indicate invalid clients or credential probing.');
      actions.push('Inspect auth failure concentration by source IP and user-agent families.');
    }

    if (hasUpstream && mentionsDeploy) {
      hypotheses.push('Upstream errors may correlate with a recent deployment.');
      actions.push('Compare error onset with deployment timestamps and recent config changes.');
    } else if (hasUpstream) {
      hypotheses.push('Upstream dependency degradation is a plausible cause of elevated failures.');
      actions.push('Check upstream health, timeouts, and recent error budgets.');
    }

    if (evidence.length === 0) {
      return createEmptyAnalysis('Insufficient evidence available for a reliable diagnosis.');
    }

    if (hypotheses.length === 0) {
      hypotheses.push('Multiple causes remain possible; current telemetry is not decisive.');
      uncertainty.push('No strong pattern matched deterministic analysis rules.');
    }

    uncertainty.push('AI analysis is advisory only and must not override security policy.');

    const confidence = Math.min(
      0.86,
      0.35 + evidence.length * 0.08 + (hypotheses.length > 0 ? 0.1 : 0),
    );

    const result = analysisResultSchema.parse({
      summary: buildSummary(context, hypotheses),
      observedEvidence: evidence.slice(0, 12),
      hypotheses,
      recommendedActions: actions.length
        ? actions
        : ['Collect additional traces and confirm whether the issue is still ongoing.'],
      confidence,
      uncertainty,
      refusedUnsupportedConclusions: true,
    });

    return result;
  }
}

function buildSummary(context: SanitizedIncidentContext, hypotheses: string[]): string {
  const lead = hypotheses[0] ?? 'Evidence is inconclusive.';
  return `Incident "${context.incident.title}" (${context.incident.severity}/${context.incident.status}): ${lead}`;
}
