# Sentinel — GitHub + Live deployment record

Author: **Roushan Kumar**

Same style checklist as MatchPath, adapted for this monorepo (API + Gateway + workers + Postgres/Redis/RabbitMQ).

## 1. Local project

| Step | What |
|------|------|
| Folder | `~/Desktop/sentinel` |
| Stack | Node.js, TypeScript, Fastify, Next.js, Prisma, Redis, RabbitMQ, OpenTelemetry |
| Apps | `api`, `gateway`, `demo-service`, `web` |
| Workers | `event-worker`, `analytics-worker`, `ai-worker` |
| Local | `pnpm install` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev:*` |
| Checks | `pnpm test`, `pnpm test:security`, `pnpm ai:eval`, `pnpm test:load:node` |

Demo login: `admin@acme.demo` / `ChangeMe-Demo-Pass1`

## 2. GitHub

```bash
cd ~/Desktop/sentinel
/usr/bin/git checkout -B main
/usr/bin/git add -A
/usr/bin/git commit -m "feat: Sentinel API security platform by Roushan Kumar"
gh repo create sentinel --public --source=. --remote=origin --push
```

Expected repo: `https://github.com/roushanronny/sentinel`

## 3. Live website options

Sentinel is not a single Next.js app like MatchPath. Full stack needs:

- PostgreSQL
- Redis
- RabbitMQ
- API + Gateway + workers

### A) Recommended for portfolio demo

1. Keep backend running locally or on Azure Container Apps (see `docs/deployment/azure.md`)
2. Deploy only the dashboard (`apps/web`) to Vercel with:

```bash
cd ~/Desktop/sentinel
vercel login
vercel --prod --yes
```

Set Vercel env:

- `NEXT_PUBLIC_API_URL` = your public API URL (Azure/Render/Railway/local tunnel)

### B) Full cloud

Follow `docs/deployment/azure.md` for API/gateway/workers + managed Postgres/Redis.

## 4. Vercel notes (web only)

Because this is a pnpm monorepo, configure the Vercel project:

- **Root Directory:** `apps/web` (or use a monorepo install at repo root)
- **Install:** `pnpm install`
- **Build:** `pnpm --filter @sentinel/web build`
- **Output:** Next.js default

If linking fails once, connect manually:

Vercel → Project → Settings → Git → `roushanronny/sentinel`

## 5. Security

- Never commit `.env`
- Demo passwords are local-only
- Rotate any leaked keys immediately
- Production secrets only in host env / Key Vault

## 6. Resume / Naukri 2-line summary

Built Sentinel, a multi-tenant API security and reliability platform (gateway, RBAC, Redis rate limiting, RabbitMQ workers, incidents, AI analysis). Published a public GitHub repo with CI, tests, docs, and a deployable Next.js dashboard plus Azure deployment guide.

## Links (fill after push/deploy)

- GitHub: `https://github.com/roushanronny/sentinel`
- Live dashboard: _(add Vercel URL after deploy)_
- Live API: _(add Azure/API URL after backend deploy)_
