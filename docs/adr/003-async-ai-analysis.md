# ADR-003: Asynchronous AI analysis

- Status: Accepted
- Date: 2026-09-19
- Author: Roushan Kumar

## Decision

AI incident analysis runs in a worker via RabbitMQ. The HTTP request path only queues analysis (or falls back to inline heuristic completion if the broker is down).

## Why

- Prevents model latency from impacting API/gateway reliability
- Allows retries, idempotency, and dead-letter handling
- Keeps AI advisory and out of enforcement

## Alternatives rejected for MVP

- Calling an LLM inside gateway middleware
- Letting AI auto-block traffic without human review
