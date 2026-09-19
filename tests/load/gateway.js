/**
 * Sentinel gateway load test (k6)
 *
 * Methodology:
 * 1. Start API, Gateway, and Demo service locally.
 * 2. Ensure seeded routes allow public GET /users.
 * 3. Run: k6 run tests/load/gateway.js
 * 4. Record RPS, p50/p95/p99, and error rate from the summary.
 *
 * Do not invent numbers. Paste the actual k6 summary into
 * docs/performance/load-test-results.md after each controlled run.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 20),
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const GATEWAY = __ENV.GATEWAY_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${GATEWAY}/users`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has rate limit headers': (r) => Boolean(r.headers['X-Ratelimit-Limit']),
  });
  sleep(0.1);
}
