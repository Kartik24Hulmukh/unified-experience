/**
 * BErozgar — Rate Limiting Plugin
 *
 * Global rate limiter with per-route overrides.
 * Uses in-memory store (fast) with user/IP keying.
 * Per-route configs applied at route-level via routeConfig.
 */

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { env } from '@/config/env';

/**
 * Per-route rate limit overrides.
 * Key = "METHOD /path", value = { max, timeWindow }.
 * Routes not listed here use the global default.
 */
export const ROUTE_RATE_LIMITS: Record<string, { max: number; timeWindow: string }> = {
  'POST /api/auth/login':          { max: 5,  timeWindow: '15 minutes' },
  'POST /api/auth/signup':         { max: 3,  timeWindow: '15 minutes' },
  'POST /api/auth/google':         { max: 10, timeWindow: '15 minutes' },
  'POST /api/listings':            { max: 10, timeWindow: '60 minutes' },
  'PATCH /api/requests/*/event':   { max: 20, timeWindow: '60 minutes' },
  'POST /api/disputes':            { max: 5,  timeWindow: '60 minutes' },
  'GET /api/admin/audit':          { max: 30, timeWindow: '60 minutes' },
  'GET /api/admin/fraud':          { max: 20, timeWindow: '60 minutes' },
  'POST /api/admin/recovery':      { max: 5,  timeWindow: '5 minutes'  },
};

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    allowList: [],
    keyGenerator: (request) => {
      // Use authenticated user ID if available, otherwise IP
      return (request as any).userId ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // Apply per-route overrides via onRoute hook
  app.addHook('onRoute', (routeOptions) => {
    const method = Array.isArray(routeOptions.method)
      ? routeOptions.method[0]
      : routeOptions.method;
    const key = `${method} ${routeOptions.url}`;

    // Check exact match first, then wildcard patterns
    let override = ROUTE_RATE_LIMITS[key];
    if (!override) {
      for (const [pattern, config] of Object.entries(ROUTE_RATE_LIMITS)) {
        // Convert wildcard pattern to check: "PATCH /api/requests/*/event" matches "PATCH /api/requests/:id/event"
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '[^/]+') + '$'
        );
        if (regex.test(key)) {
          override = config;
          break;
        }
      }
    }

    if (override) {
      routeOptions.config = {
        ...((routeOptions.config as any) || {}),
        rateLimit: {
          max: override.max,
          timeWindow: override.timeWindow,
        },
      };
    }
  });
}
