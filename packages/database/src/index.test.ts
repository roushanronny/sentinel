import { describe, expect, it } from 'vitest';
import { createPrismaClient } from './index.js';

describe('@sentinel/database', () => {
  it('creates a prisma client instance', () => {
    const client = createPrismaClient();
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
  });
});
