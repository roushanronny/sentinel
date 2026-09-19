# Security test report

Author: Roushan Kumar  
Project: Sentinel

## Controls verified

| Control | Test | Expected |
|---------|------|----------|
| Tenant isolation | Tenant A cannot read Tenant B service by ID | 404 |
| Cross-tenant org header | Member of A cannot use org B header | 403 |
| RBAC | VIEWER cannot create services | 403 |
| Session revocation | Access token rejected after logout | 401 |
| SSRF / unsafe upstream | `ftp://` upstream blocked by gateway | 500 `UNSAFE_UPSTREAM` |
| Tenant mismatch at edge | Gateway rejects mismatched `X-Organization-Id` | 403 |
| AI secret hygiene | Redaction + eval harness | No secret leakage / overclaim |

## How to run

```bash
pnpm test:security
pnpm ai:eval
```

## Notes

- These are regression tests for implemented controls, not a claim of complete attack coverage.
- Dependency scanning runs in CI (`pnpm audit`) and secret scanning via Gitleaks (non-blocking initially).
