/**
 * BErozgar — Health Routes
 *
 * System health and readiness checks.
 * GET /health       — full health report (version, uptime, DB, store counts)
 * GET /health/ready — lightweight readiness probe for orchestrators
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@/lib/prisma';

// Read version from package.json at startup
const APP_VERSION = process.env.npm_package_version ?? '1.0.0';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /** GET /health — full health report */
  app.get('/health', async (request, reply) => {
    let database = 'disconnected';
    const stores: Record<string, number> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';

      // PROD-08: store counts are business-sensitive metrics. Only expose
      // in development mode to prevent information disclosure.
      const query = request.query as Record<string, string>;
      const isDevVerbose = APP_VERSION && process.env.NODE_ENV !== 'production';
      if (isDevVerbose && query.verbose === 'true') {
        const [users, listings, requests, disputes] = await Promise.all([
          prisma.user.count(),
          prisma.listing.count(),
          prisma.request.count(),
          prisma.dispute.count(),
        ]);
        stores.users = users;
        stores.listings = listings;
        stores.requests = requests;
        stores.disputes = disputes;
      }
    } catch {
      // DB is down — return degraded status but don't crash
    }

    const status = database === 'connected' ? 'ok' : 'degraded';

    return reply.status(status === 'ok' ? 200 : 503).send({
      status,
      version: APP_VERSION,
      uptime: process.uptime(),
      database,
      ...(Object.keys(stores).length > 0 ? { stores } : {}),
      timestamp: new Date().toISOString(),
    });
  });

  /** GET /health/ready — lightweight readiness probe */
  app.get('/health/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.status(200).send({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return reply.status(503).send({
        status: 'not_ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
