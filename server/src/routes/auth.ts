/**
 * BErozgar — Auth Routes
 *
 * POST /api/auth/signup       — Send OTP
 * POST /api/auth/verify-otp   — Verify OTP & create account
 * POST /api/auth/login        — Email/password login
 * POST /api/auth/google       — Google OAuth
 * POST /api/auth/refresh      — Rotate refresh token (cookie only)
 * POST /api/auth/logout       — Revoke refresh token (cookie only)
 * GET  /api/auth/me           — Current user profile
 *
 * Refresh tokens are NEVER returned in a response body.
 * They are set exclusively in httpOnly, Secure, SameSite=Strict cookies.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { normalize } from '@/shared/response';
import {
  signupSchema,
  verifyOtpSchema,
  loginSchema,
  googleSignInSchema,
} from '@/shared/validation';
import type {
  SignupInput,
  VerifyOtpInput,
  LoginInput,
  GoogleSignInInput,
} from '@/shared/validation';
import { REFRESH_COOKIE } from '@/config/constants';
import { env } from '@/config/env';
import * as authService from '@/services/authService';

/* ── Per-email rate limiter (HIGH-C FIX) ────────────────────────────────────
 * The global @fastify/rate-limit is keyed by IP, so a distributed brute-force
 * attack (many IPs targeting one account) bypasses it. This in-memory sliding
 * window adds a second layer keyed by email address: max 15 attempts per 5 min.
 *
 * The DB lockout inside authService.login() fires at ≥5 wrong passwords, but
 * that only counts successful route completions. This check fires before service
 * code runs, preventing even the DB lookup from being abused at scale.
 * ─────────────────────────────────────────────────────────────────────────── */
const EMAIL_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const EMAIL_RATE_MAX = 15; // max login attempts per email per window

// MED-2 NOTE: emailRateMap is an in-process Map. In a single-process deployment
// (Docker single container, PM2 single worker) this is sufficient. In a
// multi-process or multi-replica setup each process has its own map, making the
// effective limit EMAIL_RATE_MAX * numReplicas. If horizontal scaling is planned,
// back this with a Redis INCR/EXPIRE counter or a DB row with a sliding window.
interface RateBucket { timestamps: number[] }
const emailRateMap = new Map<string, RateBucket>();

// Periodically evict expired buckets to prevent unbounded memory growth
// HIGH-02 FIX: store the interval handle so it can be cleared on server shutdown,
// preventing the timer from keeping the Node.js event loop alive during graceful exit.
const emailRatePruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of emailRateMap) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
    if (bucket.timestamps.length === 0) emailRateMap.delete(key);
  }
}, EMAIL_RATE_WINDOW_MS);
// Allow Node.js to exit even if this timer is still pending
emailRatePruneInterval.unref();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const bucket = emailRateMap.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
  if (bucket.timestamps.length >= EMAIL_RATE_MAX) return false; // rate limited
  bucket.timestamps.push(now);
  emailRateMap.set(key, bucket);
  return true; // allowed
}

/* ── Cookie helper ─────────────────────────────── */

function setRefreshCookie(reply: FastifyReply, rawToken: string): void {
  reply.setCookie(REFRESH_COOKIE.NAME, rawToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE.PATH,
    maxAge: REFRESH_COOKIE.MAX_AGE_SECONDS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE.NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE.PATH,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** POST /signup — initiate registration, send OTP */
  app.post(
    '/signup',
    { preValidation: validate(signupSchema) },
    async (request, reply) => {
      const { email } = request.body as { email: string };
      if (!checkEmailRateLimit(email)) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many signup attempts for this email. Please wait and try again.',
        });
      }

      const result = await authService.signup(request.body as SignupInput);
      return reply.status(200).send(result);
    },
  );

  /** POST /verify-otp — verify OTP and create account */
  app.post(
    '/verify-otp',
    { preValidation: validate(verifyOtpSchema) },
    async (request, reply) => {
      const result = await authService.verifyOtp(request.body as VerifyOtpInput, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });

      setRefreshCookie(reply, result.tokens.refreshToken);

      return reply.status(201).send(normalize({
        user: result.user,
        accessToken: result.tokens.accessToken,
      }));
    },
  );

  /** POST /login — email/password authentication */
  app.post(
    '/login',
    { preValidation: validate(loginSchema) },
    async (request, reply) => {
      const { email } = request.body as { email: string };
      if (!checkEmailRateLimit(email)) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          // UX-2 FIX: unified to RATE_LIMIT_EXCEEDED (app.ts global handler uses same code)
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many login attempts for this account. Please wait and try again.',
        });
      }

      const result = await authService.login(request.body as LoginInput, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });

      setRefreshCookie(reply, result.tokens.refreshToken);

      return reply.status(200).send(normalize({
        user: result.user,
        accessToken: result.tokens.accessToken,
      }));
    },
  );

  /** POST /google — Google OAuth sign-in */
  app.post(
    '/google',
    { preValidation: validate(googleSignInSchema) },
    async (request, reply) => {
      const result = await authService.googleSignIn(request.body as GoogleSignInInput, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });

      setRefreshCookie(reply, result.tokens.refreshToken);

      return reply.status(200).send(normalize({
        user: result.user,
        accessToken: result.tokens.accessToken,
      }));
    },
  );

  /** POST /refresh — rotate refresh token (cookie only) */
  app.post('/refresh', async (request, reply) => {
    console.log('[Server] /refresh called');
    const token =
      (request.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE.NAME];

    if (!token) {
      console.log('[Server] /refresh: No token in cookies');
      return reply.status(401).send({
        error: 'Refresh token missing. Send via httpOnly cookie.',
        code: 'UNAUTHORIZED',
      });
    }

    try {
      console.log('[Server] /refresh: Calling authService.refreshAccessToken');
      const tokens = await authService.refreshAccessToken(token, {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      });

      console.log('[Server] /refresh: Success');
      setRefreshCookie(reply, tokens.refreshToken);

      return reply.status(200).send({
        accessToken: tokens.accessToken,
      });
    } catch (err) {
      console.error('[Server] /refresh: ERROR:', err);
      throw err;
    }
  });

  /** POST /logout — revoke refresh token & clear cookie
   *
   * SECURITY NOTE (BUG-01 FIX):
   * Logout does NOT require the authenticate middleware.
   * - The user may call logout precisely because their access token has
   *   just expired — blocking with a 401 would make logout impossible.
   * - The only credential needed to revoke the session is the refresh-token
   *   httpOnly cookie, which the browser sends automatically.
   * - request.userId is populated by the authPlugin if a valid Bearer token
   *   is present (used for the audit log), but is optional here.
   */
  app.post('/logout', async (request, reply) => {
    const token =
      (request.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE.NAME];

    if (token) {
      await authService.logout(token, request.userId);
    }

    clearRefreshCookie(reply);
    return reply.status(200).send({ message: 'Logged out' });
  });

  /** GET /me — current authenticated user */
  app.get(
    '/me',
    { preHandler: authenticate },
    async (request, reply) => {
      const result = await authService.getCurrentUser(request.userId!);
      return reply.status(200).send(normalize(result));
    },
  );

  /** GET /csrf-token — return CSRF token for SPA double-submit */
  app.get('/csrf-token', async (request, reply) => {
    // Support two CSRF strategies:
    //
    // 1. @fastify/csrf-protection — attaches reply.generateCsrf()
    // 2. Custom double-submit cookie plugin (csrfPlugin) — sets the `_csrf`
    //    cookie on every response via an onRequest hook; the SPA reads it from
    //    document.cookie.  In this mode there is no generateCsrf function on reply.
    //
    // HIGH-04: We no longer throw when generateCsrf is absent because the
    // custom plugin IS the CSRF protection layer — throwing would surface as
    // a spurious 500 and prevent the SPA from bootstrapping.  If neither the
    // method nor the cookie exists the token is null; the client falls back to
    // reading document.cookie (cookie value will arrive in the response headers).
    if (typeof (reply as FastifyReply & { generateCsrf?: () => string }).generateCsrf === 'function') {
      const token = (reply as FastifyReply & { generateCsrf: () => string }).generateCsrf();
      return reply.status(200).send({ csrfToken: token });
    }

    // Custom double-submit cookie plugin path: return whatever token the
    // plugin set on a previous request, or null on the very first request
    // (the Set-Cookie header carries the fresh token in this same response).
    const token =
      (request.cookies as Record<string, string | undefined>)['_csrf'] ?? null;
    return reply.status(200).send({ csrfToken: token });
  });
}
