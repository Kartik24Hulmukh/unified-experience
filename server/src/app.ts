/**
 * BErozgar — Fastify Application Bootstrap
 *
 * Registers all plugins, middleware, and routes.
 * Exported as a factory for testability.
 */

import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { env } from '@/config/env';
import { registerCors } from '@/plugins/cors';
import { registerRateLimit } from '@/plugins/rate-limit';
import authPlugin from '@/plugins/auth';
import csrfPlugin from '@/plugins/csrf';
import sanitizePlugin from '@/plugins/sanitize';
import { idempotency, idempotencyCacheResponse } from '@/middleware/idempotency';
import { serializeError, AppError } from '@/errors/index';

// Route modules
import { healthRoutes } from '@/routes/health';
import { authRoutes } from '@/routes/auth';
import { listingRoutes } from '@/routes/listings';
import { requestRoutes } from '@/routes/requests';
import { disputeRoutes } from '@/routes/disputes';
import { adminRoutes } from '@/routes/admin';
import { profileRoutes } from '@/routes/profile';
import { analyticsRoutes } from '@/routes/analytics';

export async function buildApp() {
  // ── Sentry (optional — only when DSN is configured) ──
  if (env.SENTRY_DSN) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/node') as {
        init: (opts: Record<string, unknown>) => void;
      };
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,
        tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      });
    } catch {
      // @sentry/node not installed — skip gracefully
    }
  }

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
    bodyLimit: 10_240, // 10 KB — reject oversized payloads early
  });

  // ── Global Plugins ──────────────────────────────
  await registerCors(app);
  await app.register(helmet, {
    contentSecurityPolicy: false, // SPA handles its own CSP
  });
  await app.register(cookie, {
    secret: env.JWT_SECRET, // Cookie signing secret
    parseOptions: {},
  });
  await registerRateLimit(app);
  await app.register(authPlugin);
  await app.register(csrfPlugin);
  await app.register(sanitizePlugin);

  // ── Request ID propagation ──────────────────────
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    // Track start time for X-Response-Time
    (request as any)._startTime = process.hrtime.bigint();
  });

  // ── X-Response-Time header ──────────────────────
  app.addHook('onResponse', async (request, reply) => {
    const start = (request as any)._startTime as bigint | undefined;
    if (start) {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms
      reply.header('X-Response-Time', `${elapsed.toFixed(2)}ms`);
    }
  });

  // ── Global Error Handler ────────────────────────
  app.setErrorHandler(async (error: FastifyError | Error, request, reply) => {
    const fastifyErr = error as FastifyError;

    // Fastify validation errors
    if (fastifyErr.validation) {
      const details: Record<string, string[]> = {};
      for (const v of fastifyErr.validation) {
        const key = (v as any).instancePath?.replace('/', '') || '_root';
        if (!details[key]) details[key] = [];
        details[key].push(v.message ?? 'Invalid');
      }
      return reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details,
      });
    }

    // Application errors
    if (error instanceof AppError) {
      const serialized = serializeError(error);
      return reply.status(serialized.statusCode).send(serialized.body);
    }

    // Rate limit errors from @fastify/rate-limit
    if (fastifyErr.statusCode === 429) {
      return reply.status(429).send({
        error: error.message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // Unknown errors — log full detail, return sanitized
    request.log.error(error, 'Unhandled error');
    const serialized = serializeError(error);
    return reply.status(serialized.statusCode).send(serialized.body);
  });

  // ── Routes ──────────────────────────────────────
  // Health checks (no prefix, no auth)
  await app.register(healthRoutes);

  // API routes under /api prefix
  await app.register(
    async (api) => {
      // Idempotency middleware for mutation routes
      api.addHook('preHandler', async (request, reply) => {
        if (request.method === 'POST' || request.method === 'PATCH') {
          await idempotency(request, reply);
        }
      });

      // Cache responses for idempotent requests (must be onSend, not preHandler)
      api.addHook('onSend', async (request, reply, payload) => {
        if (request.method === 'POST' || request.method === 'PATCH') {
          return idempotencyCacheResponse(request, reply, payload as string | Buffer | null);
        }
        return payload;
      });

      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(listingRoutes, { prefix: '/' });
      await api.register(requestRoutes, { prefix: '/' });
      await api.register(disputeRoutes, { prefix: '/' });
      await api.register(profileRoutes, { prefix: '/' });
      await api.register(adminRoutes, { prefix: '/admin' });
      await api.register(analyticsRoutes, { prefix: '/analytics' });
    },
    { prefix: '/api' },
  );

  return app;
}
