# ADR-002: Redis fixed-window rate limiting

- Status: Accepted
- Date: 2026-09-19
- Author: Roushan Kumar

## Decision

Use Redis `INCR` + `PEXPIRE` fixed-window rate limiting per tenant/route, with in-memory fallback when Redis is unavailable.

## Why

- Easy to reason about and test
- Shared across multiple gateway processes
- Good interview narrative with clear upgrade path

## Trade-offs

Fixed windows can allow bursts at window boundaries. Sliding window / token bucket is a later upgrade when traffic justifies it.
