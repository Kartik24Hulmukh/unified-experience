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
  // GAP-02: use dedicated CSRF_ENFORCE env var instead of NODE_ENV comparison.
  // This prevents staging deployments that happen to run with NODE_ENV=development
  // from skipping CSRF enforcement. Set CSRF_ENFORCE=false only in .env.development.
  const enforce = env.CSRF_ENFORCE;

  // SEC-CSRF-STARTUP: emit a visible warning when CSRF is disabled so it is never
  // silently absent in staging or production deployments.
  if (!enforce) {
    app.log.warn(
      { csrfEnforce: enforce, env: process.env.NODE_ENV },
      '⚠ CSRF protection is DISABLED (CSRF_ENFORCE=false). Set CSRF_ENFORCE=true in production.',
    );
  }

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
        maxAge: 604800, // MED-5 FIX: 7 days (was 24h). A 24h expiry caused a
        // 'hard logout' pattern: after 24h the cookie was gone, the next mutation
        // fired a fresh CSRF cookie in the response Set-Cookie, but the CSRF
        // validation hook ran first → 403 CSRF_INVALID. Heavy users hit this daily.
        // 7 days aligns with the refresh-token lifetime so both expire together.
      });
      // M1-FIX: make the freshly-generated token visible to the validation
      // hook that runs later in the same request cycle. Without this, the
      // cookie is only in the response Set-Cookie header — request.cookies
      // still reads as undefined, causing a 403 on the first mutation after
      // cookie expiry.
      (request.cookies as Record<string, string>)[CSRF_COOKIE] = token;
    }
  });

  // Validate CSRF on state-changing requests
  if (enforce) {
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!STATE_CHANGING_METHODS.has(request.method)) return;
      if (EXEMPT_PATHS.has(request.url.split('?')[0])) return;

      const cookieToken = request.cookies[CSRF_COOKIE];
      const headerToken = request.headers[CSRF_HEADER] as string | undefined;

      // SEC-CSRF-04: The previous "grace" path allowed any request with a cookie
      // but no header to pass — which is exactly the attack vector CSRF protects
      // against (browser sends cookie automatically, attacker can't set header).
      // Removed the grace bypass. Clients must always send X-CSRF-Token.
      // After cookie expiry the first mutation will 403; the response Set-Cookie
      // delivers the new token and the client retries with it.

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
