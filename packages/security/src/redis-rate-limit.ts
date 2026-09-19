import type { RateLimitResult, RateLimiter } from './rate-limit.js';

export interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

/**
 * Fixed-window rate limiter backed by Redis INCR + PEXPIRE.
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: RedisLike,
    private readonly keyPrefix = 'sentinel:rl',
  ) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const windowId = Math.floor(Date.now() / windowMs);
    const redisKey = `${this.keyPrefix}:${key}:${windowId}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }

    const ttl = await this.redis.pttl(redisKey);
    const resetAtMs = Date.now() + (ttl > 0 ? ttl : windowMs);

    if (count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAtMs,
        retryAfterSeconds: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)),
      };
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - count),
      resetAtMs,
    };
  }
}
