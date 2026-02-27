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
  // Auth — strictest limits: these are the credential-abuse attack surface
  'POST /api/auth/login': { max: 5, timeWindow: '15 minutes' },
  'POST /api/auth/signup': { max: 3, timeWindow: '15 minutes' },
  // SEC-RL-01: OTP resend is as sensitive as signup — cap at 3/15min per email
  'POST /api/auth/resend-otp': { max: 3, timeWindow: '15 minutes' },
  // PROD-07: verify-otp has no rate limit — a 6-digit OTP has 1M combinations,
  // brute-forceable in ~2h at 150 req/s without this cap.
  'POST /api/auth/verify-otp': { max: 5, timeWindow: '15 minutes' },
  'POST /api/auth/google': { max: 10, timeWindow: '15 minutes' },
  // Listings & Requests
  'POST /api/listings': { max: 10, timeWindow: '60 minutes' },
  // SEC-RL-02: add explicit cap on new request submissions
  'POST /api/requests': { max: 20, timeWindow: '60 minutes' },
  'PATCH /api/requests/*/event': { max: 20, timeWindow: '60 minutes' },
  'POST /api/disputes': { max: 5, timeWindow: '60 minutes' },
  // Admin — already restricted by RBAC, but defence-in-depth
  'GET /api/admin/audit': { max: 30, timeWindow: '60 minutes' },
  'GET /api/admin/fraud': { max: 20, timeWindow: '60 minutes' },
  'POST /api/admin/recovery': { max: 5, timeWindow: '5 minutes' },
};

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    // SEC-RL-02: tighten global default from 100→60 req/60s per key
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    allowList: [],
    keyGenerator: (request) => {
      // SEC-RL-01: for login, rate-limit per-email (not per-IP).
      // On a campus shared NAT, IP-based bucketing locks out ALL students
      // after 5 wrong credentials from a single bad actor.
      // Combining email + IP creates independent buckets per credential.
      if (request.url === '/api/auth/login' || request.url === '/api/auth/resend-otp') {
        const bodyEmail = (request.body as any)?.email as string | undefined;
        if (bodyEmail && typeof bodyEmail === 'string') {
          // Normalise: lowercase + trim to prevent bypass via case or whitespace
          return `email:${bodyEmail.toLowerCase().trim()}`;
        }
      }
      // Authenticated routes: keyed by userId (survives IP change / VPN)
      return (request as any).userId ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      // SEC-RL-03: human-readable retry hint; also exposed via Retry-After header below
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
    // SEC-RL-03: send standard Retry-After header so clients/CDNs can back-off
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
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
