import { Redis } from 'ioredis';

export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: true,
  });
}

export async function connectRedis(client: Redis): Promise<void> {
  if (client.status === 'wait') {
    await client.connect();
  }
}

export { Redis };
