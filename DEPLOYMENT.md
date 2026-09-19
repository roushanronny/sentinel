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
# If workflow push is blocked by OAuth scope, push with SSH:
# /usr/bin/git remote set-url origin git@github.com:roushanronny/sentinel.git
# /usr/bin/git push -u origin main
```

Repo: https://github.com/roushanronny/sentinel  
Branch: `main`

## 3. Live website (dashboard)

Sentinel is not a single Next.js app like MatchPath. Full stack needs PostgreSQL, Redis, RabbitMQ, API, Gateway, and workers.

### A) Portfolio demo (done)

Deployed only the dashboard (`apps/web`) to Vercel:

```bash
cd ~/Desktop/sentinel/apps/web
vercel login
# Use a clean npm lockfile (not a pnpm-workspace symlink lock)
# Prefer: vercel build --prod && vercel deploy --prebuilt --prod --yes
vercel --prod --yes
```

| Item | Value |
|------|-------|
| Vercel project | `sentinel` |
| Live URL | https://sentinel-chi-plum.vercel.app |
| Alt URL | https://sentinel-roushan-kumars-projects-97d60324.vercel.app |

Optional env on Vercel:

- `NEXT_PUBLIC_API_URL` = public API URL (Azure / tunnel). Without it, login calls `http://localhost:3001`.

### B) Full cloud

Follow `docs/deployment/azure.md` for API/gateway/workers + managed Postgres/Redis.

## 4. Production fixes (what broke + how)

| Problem | Reason | Fix |
|---------|--------|-----|
| GitHub push rejected for `.github/workflows/*` | `gh` OAuth token missing `workflow` scope | Push via SSH (`git@github.com:...`) |
| Vercel `NEXT_NO_VERSION` / only ~8 packages install | `apps/web/package-lock.json` pointed at monorepo `../../node_modules/.pnpm/...` | Regenerate a real npm lockfile for standalone web deploy, or install from repo root with pnpm |
| `Vulnerable version of Next.js detected` | Next 15.1.x blocked on Vercel | Bump web app to Next **15.5.25+** |

## 5. Vercel notes (web only)

- Framework: Next.js
- Directory used for CLI deploy: `apps/web`
- Prefer Next **≥ 15.5.25** (security patch)
- If Git auto-connect fails: Vercel → Project → Settings → Git → `roushanronny/sentinel`, Root Directory `apps/web`

## 6. Security

- Never commit `.env`
- Demo passwords are local-only
- Rotate any leaked keys immediately
- Production secrets only in host env / Key Vault

## 7. Short checklist (repeat)

```bash
# 1. Local
cd ~/Desktop/sentinel
pnpm install
pnpm --filter @sentinel/web build   # must pass

# 2. GitHub
/usr/bin/git add -A
/usr/bin/git commit -m "Your message"
/usr/bin/git push origin main       # SSH remote recommended for workflows

# 3. Live (dashboard)
cd apps/web
vercel build --prod
vercel deploy --prebuilt --prod --yes
```

## 8. Resume / Naukri 2-line summary

Built Sentinel, a multi-tenant API security and reliability platform (gateway, RBAC, Redis rate limiting, RabbitMQ workers, incidents, AI analysis). Published a public GitHub repo with CI, tests, docs, and a Vercel-hosted Next.js dashboard plus Azure deployment guide.

## Links

- GitHub: https://github.com/roushanronny/sentinel
- Live dashboard: https://sentinel-chi-plum.vercel.app
- Live API: _(add after backend deploy on Azure/Render)_
