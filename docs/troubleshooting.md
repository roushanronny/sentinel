# Local troubleshooting

## Services won't start

```bash
pg_isready
redis-cli ping
rabbitmqctl status
pnpm db:migrate
pnpm db:seed
```

## Gateway returns ROUTE_NOT_FOUND

- Confirm seed created `users-api` / `orders-api` routes
- Restart gateway after seeding (route cache TTL is 5s)

## AI analysis stays queued

- Start `pnpm dev:ai-worker`
- Confirm RabbitMQ is healthy
- Check processed_messages for idempotency collisions within the same minute

## Auth login fails for demo users

- Re-run `pnpm db:seed`
- Password: `ChangeMe-Demo-Pass1`
