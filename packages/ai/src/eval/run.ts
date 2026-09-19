import { analyzeSanitizedIncident } from '../analyze.js';
import { EVAL_CASES } from './cases.js';

export interface EvalReportRow {
  id: string;
  name: string;
  passed: boolean;
  failures: string[];
  confidence: number;
}

export async function runAiEvaluation(): Promise<{
  passed: number;
  failed: number;
  rows: EvalReportRow[];
}> {
  const rows: EvalReportRow[] = [];

  for (const testCase of EVAL_CASES) {
    const result = await analyzeSanitizedIncident(testCase.context, { AI_PROVIDER: 'heuristic' });
    const failures: string[] = [];
    const text = JSON.stringify(result.analysis).toLowerCase();

    for (const needle of testCase.expect.mustIncludeEvidence ?? []) {
      if (!text.includes(needle.toLowerCase())) {
        failures.push(`missing evidence mention: ${needle}`);
      }
    }

    if (testCase.expect.mustIncludeHypothesisSubstring?.length) {
      const hit = testCase.expect.mustIncludeHypothesisSubstring.some((part) =>
        text.includes(part.toLowerCase()),
      );
      if (!hit) {
        failures.push('expected hypothesis substring not found');
      }
    }

    if (testCase.expect.mustExpressUncertainty) {
      if (result.analysis.confidence > 0.4 || result.analysis.uncertainty.length === 0) {
        failures.push('expected explicit uncertainty for insufficient evidence');
      }
    }

    if (testCase.expect.mustNotClaimCertainty) {
      if (result.analysis.confidence >= 0.95) {
        failures.push('confidence too high / overclaim');
      }
      if (/definitely|certainly|proven|without doubt/i.test(JSON.stringify(result.analysis))) {
        failures.push('analysis used certainty language');
      }
    }

    rows.push({
      id: testCase.id,
      name: testCase.name,
      passed: failures.length === 0,
      failures,
      confidence: result.analysis.confidence,
    });
  }

  const passed = rows.filter((row) => row.passed).length;
  return { passed, failed: rows.length - passed, rows };
}

async function main(): Promise<void> {
  const report = await runAiEvaluation();
  for (const row of report.rows) {
    const mark = row.passed ? 'PASS' : 'FAIL';
    // eslint-disable-next-line no-console
    console.log(`${mark} ${row.id} confidence=${row.confidence.toFixed(2)}`);
    if (!row.passed) {
      for (const failure of row.failures) {
        // eslint-disable-next-line no-console
        console.log(`  - ${failure}`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Summary: ${report.passed} passed, ${report.failed} failed`);
  if (report.failed > 0) process.exit(1);
}

if (process.argv[1]?.includes('eval/run')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
