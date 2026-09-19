# Azure deployment guide

Author: Roushan Kumar

This guide deploys Sentinel to Azure using container apps / App Service patterns. It assumes images are built from `infrastructure/docker`.

## Recommended topology

```text
Azure Container Apps / App Service
  ├── web (Next.js)
  ├── api (control plane)
  ├── gateway
  ├── demo-service (optional, demo only)
  └── workers (event, analytics, ai)

Azure Database for PostgreSQL Flexible Server
Azure Cache for Redis
Azure Service Bus or Azure-hosted RabbitMQ (or Container Apps RabbitMQ for lab)
Azure Key Vault (secrets)
Azure Monitor + Application Insights (OpenTelemetry OTLP later)
```

## Prerequisites

- Azure CLI logged in
- Resource group + ACR
- Secrets stored in Key Vault / Container Apps secrets:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `RABBITMQ_URL`
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`

## Build images

```bash
az acr login --name <acrName>
docker build -f infrastructure/docker/Dockerfile.api -t <acrName>.azurecr.io/sentinel-api:0.1.0 .
docker build -f infrastructure/docker/Dockerfile.gateway -t <acrName>.azurecr.io/sentinel-gateway:0.1.0 .
docker push <acrName>.azurecr.io/sentinel-api:0.1.0
docker push <acrName>.azurecr.io/sentinel-gateway:0.1.0
```

## Database migrate

Run migrations from CI or a one-off job:

```bash
pnpm --filter @sentinel/database exec prisma migrate deploy
pnpm db:seed   # demo only; avoid in real customer environments
```

## Container Apps (example)

```bash
az containerapp create \
  --name sentinel-api \
  --resource-group <rg> \
  --environment <env> \
  --image <acrName>.azurecr.io/sentinel-api:0.1.0 \
  --target-port 3001 \
  --ingress external \
  --env-vars \
    DATABASE_URL=secretref:database-url \
    REDIS_URL=secretref:redis-url \
    RABBITMQ_URL=secretref:rabbitmq-url \
    JWT_ACCESS_SECRET=secretref:jwt-access \
    JWT_REFRESH_SECRET=secretref:jwt-refresh \
    AI_PROVIDER=heuristic
```

Repeat for gateway (port 3000) and workers (no ingress).

## Production checklist

- [ ] Rotate all demo secrets
- [ ] Disable demo-service in non-demo environments
- [ ] Restrict upstream URL allowlist (no broad localhost in production)
- [ ] Enable HTTPS only ingress
- [ ] Configure backups for PostgreSQL
- [ ] Set retention for security events / audit logs
- [ ] Wire OpenTelemetry exporter to Azure Monitor

## Limitations

This is a portfolio-ready deployment path, not an automatically provisioned production landing zone. Validate quotas, networking, private endpoints, and identity (managed identity + Key Vault) before calling an environment production-ready.
