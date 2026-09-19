import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __sentinelPrisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalThis.__sentinelPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sentinelPrisma = prisma;
}

export * from '@prisma/client';
