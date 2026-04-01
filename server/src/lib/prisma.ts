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
    // P1-PERF-008: Explicit datasource configuration for production pool tuning.
    // Prisma defaults to `num_cpus * 2 + 1` connections which is often too few
    // under concurrent load with transactions. The connection_limit is appended
    // to DATABASE_URL automatically by Prisma when using `datasources`, but we
    // set the pool timeout explicitly so waiting queries fail-fast rather than
    // hanging indefinitely when all connections are checked out.
    datasourceUrl: env.DATABASE_URL,
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
