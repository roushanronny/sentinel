#!/usr/bin/env bash
set -euo pipefail

API="${API_URL:-http://localhost:3001}"
GATEWAY="${GATEWAY_URL:-http://localhost:3000}"
DEMO="${DEMO_URL:-http://localhost:3002}"

echo "==> Health checks"
curl -sf "$API/health" >/dev/null && echo "api ok"
curl -sf "$GATEWAY/health" >/dev/null && echo "gateway ok"
curl -sf "$DEMO/health" >/dev/null && echo "demo ok"

echo "==> Direct demo upstream"
curl -sf "$DEMO/users" | head -c 120
echo

echo "==> Gateway proxy (public GET /users)"
curl -si "$GATEWAY/users" | head -n 20

echo "==> Gateway auth failure on protected POST /orders"
curl -si -X POST "$GATEWAY/orders" -H 'content-type: application/json' -d '{"total":10}' | head -n 20

echo "==> Done. Check dashboard Security Events + RabbitMQ worker logs."
