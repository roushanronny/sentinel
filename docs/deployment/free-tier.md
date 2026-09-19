# Free-tier live backend (portfolio)

Author: **Roushan Kumar**

Goal: real login + DB on the internet without paying. Redis/RabbitMQ are **optional** — Gateway/API already fall back to in-memory rate limits and sync/inline processing.

## Free stack we use

| Need | Free option | Notes |
|------|-------------|-------|
| Postgres | **Neon** (or Railway Postgres on trial) | Required |
| API process | **Railway** free trial / Hobby credits | Required |
| Redis | Skip / **Upstash** later | Memory rate limit OK for demo |
| RabbitMQ | Skip | AI runs **inline**; events write to DB sync |
| Dashboard | **Vercel** (already live) | Set `NEXT_PUBLIC_API_URL` |

## One-time setup

### 1) Neon Postgres (free)

1. https://console.neon.tech → Sign up with GitHub  
2. Create project `sentinel`  
3. Copy **Connection string** (pooled OK) → `DATABASE_URL`

### 2) Railway API (free trial credit)

```bash
cd ~/Desktop/sentinel
railway login          # browser / CLI pair
railway init           # project: sentinel
railway add --database postgres   # OR paste Neon DATABASE_URL
railway variables set \
  JWT_ACCESS_SECRET="$(openssl rand -hex 32)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  AI_PROVIDER=heuristic \
  SEED_ON_BOOT=true \
  CORS_ORIGINS=https://sentinel-chi-plum.vercel.app \
  NODE_ENV=production
# If using Neon instead of Railway Postgres:
railway variables set DATABASE_URL="postgresql://..."
railway up
railway domain
```

### 3) Point Vercel dashboard at live API

```bash
cd apps/web
vercel env add NEXT_PUBLIC_API_URL production
# value = https://YOUR-API.up.railway.app
# Redeploy web
```

Or Vercel Dashboard → Project `sentinel` → Environment Variables → Redeploy.

### 4) Verify

```bash
curl https://YOUR-API.up.railway.app/health
# Then Sign in on https://sentinel-chi-plum.vercel.app with admin@acme.demo
```

When API is reachable, login uses **real DB** (not portfolio demo mode).

## Limits (honest)

- Free/trial credits sleep or run out — portfolio demo, not always-on production SLA  
- Single-instance memory rate limits (no shared Redis)  
- No separate gateway/workers on free tier unless you add more services  
- Full gateway + Redis + RabbitMQ → Hobby plan or Azure (see `azure.md`)
