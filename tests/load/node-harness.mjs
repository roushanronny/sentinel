/**
 * Lightweight concurrent load harness used when k6 is not installed.
 * Measures actual latency percentiles against a running gateway.
 */
import { performance } from 'node:perf_hooks';

const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const TOTAL = Number(process.env.TOTAL ?? 200);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 20);
const PATH = process.env.PATH_NAME ?? '/users';

async function oneRequest() {
  const start = performance.now();
  const response = await fetch(`${GATEWAY}${PATH}`);
  const ms = performance.now() - start;
  return { status: response.status, ms };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function main() {
  const health = await fetch(`${GATEWAY}/health`);
  if (!health.ok) {
    throw new Error(`Gateway health check failed at ${GATEWAY}`);
  }

  const latencies = [];
  const statusCounts = {};
  let failures = 0;
  let rateLimited = 0;
  let completed = 0;
  const started = performance.now();

  async function worker() {
    while (completed < TOTAL) {
      completed += 1;
      try {
        const result = await oneRequest();
        latencies.push(result.ms);
        statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
        if (result.status === 429) rateLimited += 1;
        if (result.status >= 500) failures += 1;
      } catch {
        failures += 1;
        statusCounts.error = (statusCounts.error ?? 0) + 1;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const elapsedSec = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);

  const summary = {
    path: PATH,
    total: TOTAL,
    concurrency: CONCURRENCY,
    statusCounts,
    serverErrors: failures,
    rateLimited,
    errorRate5xx: Number((failures / TOTAL).toFixed(4)),
    rps: Number((TOTAL / elapsedSec).toFixed(2)),
    p50Ms: Number(percentile(latencies, 50).toFixed(2)),
    p95Ms: Number(percentile(latencies, 95).toFixed(2)),
    p99Ms: Number(percentile(latencies, 99).toFixed(2)),
    elapsedSec: Number(elapsedSec.toFixed(2)),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
