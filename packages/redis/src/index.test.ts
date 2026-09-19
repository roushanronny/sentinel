import { afterAll, describe, expect, it } from 'vitest';
import { createRedisClient } from './index.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('@sentinel/redis', () => {
  const client = createRedisClient(redisUrl);

  afterAll(async () => {
    await client.quit().catch(() => undefined);
  });

  it('connects and responds to ping', async () => {
    if (client.status === 'wait') {
      await client.connect();
    }
    await expect(client.ping()).resolves.toBe('PONG');
  });
});
