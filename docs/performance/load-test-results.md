# Load test results

Author: Roushan Kumar

## Environment

- Date: 2026-09-19
- Host: local macOS development machine
- Gateway: `http://localhost:3000`
- Upstream: Sentinel demo-service on `:3002`
- Tool: Node concurrent harness (`pnpm test:load:node`)
- Route under test: `GET /users`
- Notes: rate limit temporarily raised to 100000 RPM for latency measurement, then restored to 120 RPM

## Measured run

```json
{
  "path": "/users",
  "total": 200,
  "concurrency": 20,
  "statusCounts": { "200": 200 },
  "serverErrors": 0,
  "rateLimited": 0,
  "errorRate5xx": 0,
  "rps": 1608.46,
  "p50Ms": 8.23,
  "p95Ms": 34.74,
  "p99Ms": 46.87,
  "elapsedSec": 0.12
}
```

## Interpretation

- These are local single-host numbers, not a cloud SLA claim.
- With the default seeded limit (120 RPM), bursts intentionally produce `429` responses — that behavior is expected and covered by gateway tests.
- Re-run and replace this file before citing numbers on a resume for a different machine.
