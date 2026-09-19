# Sentinel

**AI-Powered API Security and Reliability Platform**

Built by **Roushan Kumar**

Sentinel sits in front of upstream APIs as a security and observability gateway. It helps engineering teams protect APIs, monitor traffic, detect suspicious behavior, investigate incidents, and get read-only AI assistance from sanitized telemetry.

> Portfolio project. Do not claim unbounded production scale or perfect security without measured evidence.

## Problem

Modern products expose many APIs (`/login`, `/payments`, `/users`), but teams often lack:

- Consistent authentication and authorization at the edge
- Per-tenant and per-route rate limiting
- Clear request validation and abuse detection
- Correlated logs, traces, and metrics for incidents
- A safe way to analyze security events without leaking secrets

## Demo

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed

pnpm dev:api                 # :3001
pnpm dev:gateway             # :3000
pnpm dev:demo                # :3002
pnpm dev:worker
pnpm dev:analytics-worker
pnpm dev:ai-worker
pnpm dev:web                 # :3003
```

- Dashboard: http://localhost:3003
- Login: `admin@acme.demo` / `ChangeMe-Demo-Pass1`
- Gateway demo: `pnpm demo:gateway`
- AI eval: `pnpm ai:eval`
- Security regressions: `pnpm test:security`
- Load harness: `pnpm test:load:node` (k6 optional: `pnpm test:load`)

## Architecture

```text
Client / Dashboard
        │
        ▼
 Control Plane API  ──► PostgreSQL
        │
        ├── Redis (rate limits / short-lived state)
        └── RabbitMQ (security events + AI analysis)
                ├── event-worker
                ├── analytics-worker
                └── ai-worker
        │
        ▼
   API Gateway ──► Demo Upstream API
        │
        ▼
 Observability (OpenTelemetry) + Security Events + Incidents + AI analysis
```

Starting choice: **modular monolith** + separate gateway process + async workers.

## Implemented features

- Multi-tenant identity (Argon2id, JWT, refresh rotation, session revocation)
- RBAC: OWNER / ADMIN / ENGINEER / VIEWER
- Service + route registry with SSRF-safe upstream URLs
- API gateway proxy, auth gates, Redis rate limits, security events
- RabbitMQ async processing with retries / DLQ / idempotency
- Incidents + timeline + notes
- AI incident analysis (heuristic default, optional OpenAI-compatible provider)
- Next.js dashboard (overview, services, events, incidents, audit)
- CI workflows, Dockerfiles, Azure deploy guide, load + security reports

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript |
| Backend | Node.js, TypeScript, Fastify |
| Data | PostgreSQL, Prisma |
| Cache / limits | Redis |
| Messaging | RabbitMQ |
| Observability | OpenTelemetry, Pino |
| AI | Provider abstraction + heuristic analyzer |
| CI/CD | GitHub Actions |
| Cloud target | Azure |

## Engineering Decisions

1. **Modular monolith first** — clear module boundaries without premature microservice ops cost.
2. **Separate gateway process** — keeps the hot path isolated from control-plane work.
3. **Deterministic security rules before AI** — AI never silently overrides policy.
4. **AI off the request path** — analysis is queued asynchronously.
5. **Redis fixed-window rate limiting** — simple, shared across gateway instances, memory fallback.
6. **Sanitized AI context only** — secrets/tokens redacted; recommendations are read-only.

## What I Would Improve at 10x Scale

- Extract analytics/read models from the primary Postgres OLTP schema
- Move rate limiting to sliding window / token bucket with per-route budgets
- Add OTel collectors + long-term metrics storage (Prometheus/Grafana or Azure Monitor)
- Shard tenants / isolate noisy neighbors
- Replace demo upstream allowlisting with stronger service mesh / egress policy
- Add multi-region failover and formal SLO error budgets
- Expand AI evaluation set and human feedback loop

## How I Used AI Responsibly

- Used AI assistance for scaffolding and iteration, then verified with tests and live smoke runs
- Kept security decisions deterministic and reviewable
- Forced AI outputs into structured schemas with evidence / hypothesis separation
- Built an evaluation harness (`pnpm ai:eval`) instead of trusting vibes
- Never send passwords, JWTs, API keys, or raw sensitive bodies to the model
- AI recommendations do not execute gateway or security actions

## Security & testing

- Report: [docs/security/security-test-report.md](docs/security/security-test-report.md)
- Performance methodology: [docs/performance/load-test-methodology.md](docs/performance/load-test-methodology.md)
- Azure deploy: [docs/deployment/azure.md](docs/deployment/azure.md)
- Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md)

## Limitations

- Local/demo oriented seed data
- Heuristic AI is strong for portfolio demos; external model quality depends on provider config
- Load numbers are environment-specific; record actual harness output before citing them
- Not a claim of being secure against all attacks or ready for arbitrary production traffic

## Author

**Roushan Kumar**  
Software Engineer — Backend / Platform / Security-focused systems

## License

MIT © Roushan Kumar
