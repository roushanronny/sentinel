# Load test methodology

## Scope

Gateway public route `GET /users` proxied to the demo upstream.

## Prerequisites

- `pnpm dev:demo`
- `pnpm dev:gateway` (with DB seeded routes)
- [k6](https://k6.io/docs/get-started/installation/) installed

## Command

```bash
k6 run tests/load/gateway.js
# optional:
VUS=50 DURATION=60s k6 run tests/load/gateway.js
```

## What to record

From the k6 summary:

- iterations / RPS (`http_reqs`)
- `http_req_duration` p50 / p95 / p99
- `http_req_failed` rate
- machine notes (CPU cores, memory)

## Results

See `load-test-results.md` for the latest measured run. Never invent metrics.
