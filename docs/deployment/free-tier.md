# Free-tier live stack (₹0)

Author: **Roushan Kumar**

## What is live now

| Part | Free service | Status |
|------|--------------|--------|
| Dashboard UI | **Vercel** | https://sentinel-chi-plum.vercel.app |
| API (login, overview, …) | **Vercel** `/api/*` routes | Same URL |
| Postgres | **Neon** Free | Seeded (`admin@acme.demo`) |
| Redis | Skipped | Not required for this path |
| RabbitMQ / workers | Skipped | AI runs **inline** on `/api/.../analyze` |
| Gateway | Not on free live | Local / Azure later |

## Login

- URL: https://sentinel-chi-plum.vercel.app  
- Email: `admin@acme.demo`  
- Password: `ChangeMe-Demo-Pass1`  

Hard refresh once (Cmd+Shift+R). First request after Neon sleep can take a few seconds.

## Cost

- Neon Free + Vercel Hobby = **₹0** (no card used for this setup)  
- Do **not** add a payment method on Neon/Vercel unless you choose to upgrade later

## Not included on this free path

- Separate Gateway process (real traffic proxy)  
- Shared Redis rate limiting across many instances  
- RabbitMQ background workers  

Those remain for local Docker Compose / Azure (see `azure.md`).
