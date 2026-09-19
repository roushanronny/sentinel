# Database package

Prisma schema and client for Sentinel.

## Commands

```bash
# From repository root
pnpm --filter @sentinel/database prisma:generate

# Requires Docker Postgres running
pnpm --filter @sentinel/database exec prisma migrate dev --name init
pnpm --filter @sentinel/database prisma:seed
```

## Demo seed

- Organization: `acme-demo`
- Users: `admin@acme.demo` (OWNER), `engineer@acme.demo` (ENGINEER), `viewer@acme.demo` (VIEWER)
- Services: `users-api`, `orders-api`

Passwords for demo users use Argon2id.

Demo password (local only): `ChangeMe-Demo-Pass1`
