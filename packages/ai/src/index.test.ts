import { describe, expect, it } from 'vitest';
import { HeuristicIncidentAnalyzer } from './heuristic.js';
import { assertNoSecrets, redactUnknown } from './redact.js';
import { runAiEvaluation } from './eval/run.js';

describe('@sentinel/ai redaction', () => {
  it('redacts secret-like values', () => {
    const redacted = redactUnknown({
      authorization: 'Bearer abc.def.ghi',
      note: 'token=eyJhbGciOiJIUzI1NiJ9.abc.def',
      safe: 'AUTH_FAILURE from 203.0.113.10',
    }) as Record<string, unknown>;

    expect(redacted.authorization).toBe('[REDACTED]');
    expect(String(redacted.note)).toContain('[REDACTED]');
    expect(redacted.safe).toBe('AUTH_FAILURE from 203.0.113.10');
    expect(() => assertNoSecrets({ password: 'x' })).not.toThrow();
  });
});

describe('@sentinel/ai heuristic analyzer', () => {
  it('produces auth-abuse hypothesis from combined evidence', async () => {
    const analyzer = new HeuristicIncidentAnalyzer();
    const result = await analyzer.analyzeIncident({
      incident: {
        id: '1',
        title: 'Login failures',
        severity: 'HIGH',
        status: 'OPEN',
      },
      timeline: [],
      securityEvents: [
        {
          eventType: 'AUTH_FAILURE',
          severity: 'MEDIUM',
          description: 'auth failed',
          createdAt: new Date().toISOString(),
        },
        {
          eventType: 'RATE_LIMIT_EXCEEDED',
          severity: 'HIGH',
          description: 'rate limited',
          createdAt: new Date().toISOString(),
        },
      ],
      metricsHints: [],
    });

    expect(result.observedEvidence.length).toBeGreaterThan(0);
    expect(result.hypotheses.join(' ').toLowerCase()).toMatch(/auth|credential|brute/);
    expect(result.confidence).toBeLessThan(0.95);
  });
});

describe('@sentinel/ai evaluation harness', () => {
  it('passes fixed evaluation suite', async () => {
    const report = await runAiEvaluation();
    expect(report.failed).toBe(0);
  });
});
