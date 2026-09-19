# Cross-cutting tests

| Suite | Command |
|-------|---------|
| Unit / package tests | `pnpm test` |
| Security regressions | `pnpm test:security` |
| AI evaluation | `pnpm ai:eval` |
| Load harness (Node) | `pnpm test:load:node` |
| Load harness (k6) | `pnpm test:load` |

Reports live under `docs/security`, `docs/performance`, and `docs/ai`.
