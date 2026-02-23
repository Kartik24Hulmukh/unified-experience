/**
 * BErozgar — Prisma Client Singleton
 *
 * Single database connection reused across the application.
 * In development, prevents hot-reload from creating multiple connections.
 */

import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
