export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * Fixed-window rate limiter suitable for single-process and tests.
 * Redis-backed limiter will implement the same interface later.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; windowStart: number }>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const bucketKey = `${key}:${Math.floor(now / windowMs)}`;
    const existing = this.windows.get(bucketKey);

    if (!existing) {
      this.windows.set(bucketKey, { count: 1, windowStart: now });
      this.prune(now, windowMs);
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - 1),
        resetAtMs: Math.floor(now / windowMs) * windowMs + windowMs,
      };
    }

    existing.count += 1;
    const resetAtMs = Math.floor(now / windowMs) * windowMs + windowMs;
    if (existing.count > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAtMs,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      };
    }

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - existing.count),
      resetAtMs,
    };
  }

  private prune(now: number, windowMs: number): void {
    if (this.windows.size < 500) return;
    for (const [key, value] of this.windows.entries()) {
      if (now - value.windowStart > windowMs * 2) {
        this.windows.delete(key);
      }
    }
  }
}
