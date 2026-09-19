# AI evaluation report

Author: Roushan Kumar

## Command

```bash
pnpm ai:eval
```

## Latest results (heuristic provider)

```text
PASS auth-abuse confidence=0.77
PASS upstream-timeout confidence=0.61
PASS insufficient-evidence confidence=0.20
PASS prompt-injection-noise confidence=0.53
Summary: 4 passed, 0 failed
```

## What this proves

- Evidence is referenced instead of invented
- Auth-abuse and upstream scenarios produce expected hypothesis families
- Insufficient evidence stays low-confidence
- Instructional noise in event text does not force certainty claims
- Recommendations remain advisory / read-only by design
