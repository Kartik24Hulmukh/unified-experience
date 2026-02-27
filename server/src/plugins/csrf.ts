/**
 * BErozgar — CSRF Protection Plugin
 *
 * Double-submit cookie pattern:
 * 1. Server sets a `_csrf` cookie with a random token on every request.
 * 2. Client reads the cookie and sends it back as `X-CSRF-Token` header.
 * 3. Server validates header === cookie on state-changing methods (POST, PUT, PATCH, DELETE).
 *
 * This works because:
 * - Cookies are sent automatically by the browser (so the attacker's form sends it).
 * - But the attacker cannot READ the cookie (due to SameSite + CORS origin restrictions)
 *   and therefore cannot set the X-CSRF-Token header.
 *
 * Skipped in non-production when CSRF is not critical (dev/test).
 */

import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '@/config/env';

const CSRF_COOKIE = '_csrf';
const CSRF_HEADER = 'x-csrf-token';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Routes exempt from CSRF (login must work without prior cookie) */
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/verify-otp',  // AUTH-SESSION-05: called before session exists (no CSRF cookie yet)
  '/api/auth/google',
  '/api/auth/refresh',
  '/api/auth/logout',      // AUTH-SESSION-06: teardown must always succeed
  '/health',
]);

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function csrfPlugin(app: FastifyInstance): Promise<void> {
  // SEC-CSRF-01: enforce in all non-development environments.
  // Previously was limited to 'production' only, leaving staging servers wide open.
  const enforce = env.NODE_ENV !== 'development';

  // Set CSRF cookie on every response if not already present
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const existing = request.cookies[CSRF_COOKIE];
    if (!existing) {
      const token = generateToken();
      reply.setCookie(CSRF_COOKIE, token, {
        path: '/',
        httpOnly: false, // Client JS must read this to send as header
        sameSite: 'strict',
        secure: env.COOKIE_SECURE,
        maxAge: 86400, // 24h
      });
    }
  });

  // Validate CSRF on state-changing requests
  if (enforce) {
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!STATE_CHANGING_METHODS.has(request.method)) return;
      if (EXEMPT_PATHS.has(request.url.split('?')[0])) return;

      const cookieToken = request.cookies[CSRF_COOKIE];
      const headerToken = request.headers[CSRF_HEADER] as string | undefined;

      // SEC-CSRF-03: explicit emptiness check before any comparison
      if (!cookieToken || !headerToken) {
        return reply.status(403).send({
          error: 'CSRF validation failed',
          code: 'CSRF_INVALID',
          message: 'Missing or invalid CSRF token. Include X-CSRF-Token header.',
        });
      }

      // SEC-CSRF-02: timing-safe comparison prevents timing side-channel leaks
      const cookieBuf = Buffer.from(cookieToken);
      const headerBuf = Buffer.from(headerToken);
      const tokensMatch =
        cookieBuf.length === headerBuf.length &&
        crypto.timingSafeEqual(cookieBuf, headerBuf);

      if (!tokensMatch) {
        return reply.status(403).send({
          error: 'CSRF validation failed',
          code: 'CSRF_INVALID',
          message: 'Missing or invalid CSRF token. Include X-CSRF-Token header.',
        });
      }
    });
  }
}

export default fp(csrfPlugin, { name: 'csrf' });
