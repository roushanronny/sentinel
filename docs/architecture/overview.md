# Architecture Overview

**Project:** Sentinel — AI-Powered API Security and Reliability Platform  
**Author:** Roushan Kumar

## Goals

Provide a multi-tenant platform that:

1. Proxies API traffic through a controlled gateway
2. Enforces authentication, authorization, validation, and rate limits
3. Emits structured telemetry for reliability investigation
4. Detects security events with deterministic rules
5. Optionally analyzes sanitized incidents with AI asynchronously

## Process boundaries

| Process | Responsibility |
|---------|----------------|
| `apps/api` | Control plane: identity, orgs, services, routes, incidents, settings |
| `apps/gateway` | Hot path: authn/z, rate limit, validate, proxy, emit events |
| `apps/demo-service` | Safe upstream for demos and failure simulations |
| `workers/*` | Async consumers for events, analytics, AI |

## Data stores

| Store | Use |
|-------|-----|
| PostgreSQL | Transactional metadata, audit, incidents |
| Redis | Rate limiting, session revocation, short-lived cache |
| RabbitMQ | Decouple security/analytics processing from request path |

## Key design choice

Start as a modular monolith with a separate gateway process. Extract services only when ownership, scale, or failure isolation requires it.

## Request lifecycle (target)

1. Receive request and assign `x-request-id`
2. Resolve tenant and route from registered configuration
3. Authenticate and authorize
4. Apply rate limits
5. Validate size/schema
6. Apply deterministic security checks
7. Proxy to allowlisted upstream only
8. Capture response metadata
9. Publish telemetry/security events asynchronously
10. Return response

## Non-goals for Milestone 1

- Prisma models
- Auth endpoints
- Real proxying
- AI analysis
- Frontend dashboard
