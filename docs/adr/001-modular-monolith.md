# ADR-001: Modular Monolith with Separate Gateway

- **Status:** Accepted
- **Date:** 2026-09-19
- **Author:** Roushan Kumar

## Context

Sentinel needs multiple capabilities: identity, gateway proxying, security detection, observability, incidents, and later AI analysis. A common temptation is to start with many microservices.

## Decision

Build a **modular monolith** for the control plane (`apps/api`) with clearly separated modules, and run the **API gateway as a separate process** (`apps/gateway`). Background workers remain separate processes but start as thin scaffolds.

## Alternatives considered

1. **Many microservices from day one** — high operational cost, harder local development, weak domain boundaries early.
2. **Single process for API + gateway** — simpler, but mixes hot-path latency concerns with control-plane workloads.
3. **Serverless-only design** — useful later for some workers, but complicates local gateway behavior and stateful Redis patterns.

## Consequences

### Positive

- Faster iteration and clearer module ownership
- Gateway can scale and fail independently
- Strong interview narrative around intentional architecture

### Negative

- Control-plane modules share a deployment unit initially
- Must maintain discipline around module boundaries

## When to revisit

- Independent team ownership requires separate deployables
- Gateway and control plane have conflicting scaling profiles that hurt cost/reliability
- Queue/worker load justifies dedicated services with independent SLOs
