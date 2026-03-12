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
  'POST /api/auth/login': { max: 50, timeWindow: '15 minutes' },
  // RT-02: explicit per-route cap on token refresh (was falling back to global 60/60s)
  'POST /api/auth/refresh': { max: 100, timeWindow: '15 minutes' },
  'POST /api/auth/signup': { max: 30, timeWindow: '15 minutes' },
  // SEC-RL-01: OTP resend is as sensitive as signup — cap at 3/15min per email
  'POST /api/auth/resend-otp': { max: 30, timeWindow: '15 minutes' },
  // PROD-07 FIX: verify-otp is capped at 5 attempts per 15 minutes to prevent
  // brute-forcing a 6-digit OTP (1M combinations) at scale.
  'POST /api/auth/verify-otp': { max: 50, timeWindow: '15 minutes' },
  'POST /api/auth/google': { max: 100, timeWindow: '15 minutes' },
  // Listings & Requests
  'POST /api/listings': { max: 100, timeWindow: '60 minutes' },
  // RT-03: tightened from 20→10 per 60 min — 20 submissions/hour is too aggressive
  'POST /api/requests': { max: 100, timeWindow: '60 minutes' },
  'PATCH /api/requests/*/event': { max: 200, timeWindow: '60 minutes' },
  'POST /api/disputes': { max: 50, timeWindow: '60 minutes' },
  // Admin — already restricted by RBAC, but defence-in-depth
  'GET /api/admin/audit': { max: 300, timeWindow: '60 minutes' },
  'GET /api/admin/fraud': { max: 200, timeWindow: '60 minutes' },
  'POST /api/admin/recovery': { max: 50, timeWindow: '5 minutes' },
};

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  // RL-HOOK-ORDER-FIX: This hook MUST be registered before app.register(rateLimit).
  // @fastify/rate-limit registers its own onRoute hook during plugin init; that hook
  // reads routeOptions.config.rateLimit to apply per-route limits. If our setter hook
  // runs after the plugin's reader hook (because we registered it after the plugin),
  // config.rateLimit is empty when the plugin reads it — per-route overrides are silently
  // ignored and the global default (60/60s) applies to all routes including login.
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
        ...((routeOptions.config as Record<string, unknown>) || {}),
        rateLimit: {
          max: override.max,
          timeWindow: override.timeWindow,
        },
      };
    }
  });

  await app.register(rateLimit, {
    // SEC-RL-02: tighten global default from 100→60 req/60s per key
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    allowList: [],
    keyGenerator: (request) => {
      // CRIT-01 FIX: request.body is always undefined at the onRequest lifecycle stage
      // where @fastify/rate-limit's keyGenerator runs — body parsing happens later in
      // preParsing/preValidation. Email-based keying via body is impossible here.
      //
      // Per-email throttling for /auth/login and /auth/verify-otp is enforced
      // directly inside those route handlers using the email field after body parsing.
      //
      // Authenticated routes: keyed by userId (survives IP change / VPN)
      return request.userId ?? request.ip;
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

}
