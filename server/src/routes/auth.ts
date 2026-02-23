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
import { REFRESH_COOKIE } from '@/config/constants';
import { env } from '@/config/env';
import * as authService from '@/services/authService';

/* ── Cookie helper ─────────────────────────────── */

function setRefreshCookie(reply: FastifyReply, rawToken: string): void {
  reply.setCookie(REFRESH_COOKIE.NAME, rawToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE.PATH,
    maxAge: REFRESH_COOKIE.MAX_AGE_SECONDS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE.NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'strict',
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
      const result = await authService.signup(request.body as any);
      return reply.status(200).send(result);
    },
  );

  /** POST /verify-otp — verify OTP and create account */
  app.post(
    '/verify-otp',
    { preValidation: validate(verifyOtpSchema) },
    async (request, reply) => {
      const result = await authService.verifyOtp(request.body as any, {
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
      const result = await authService.login(request.body as any, {
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
      const result = await authService.googleSignIn(request.body as any, {
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
    const token =
      (request.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE.NAME];

    if (!token) {
      return reply.status(401).send({
        error: 'Refresh token missing. Send via httpOnly cookie.',
        code: 'UNAUTHORIZED',
      });
    }

    const tokens = await authService.refreshAccessToken(token, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    setRefreshCookie(reply, tokens.refreshToken);

    return reply.status(200).send({
      accessToken: tokens.accessToken,
    });
  });

  /** POST /logout — revoke refresh token & clear cookie */
  app.post('/logout', async (request, reply) => {
    const token =
      (request.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE.NAME];

    if (token) {
      await authService.logout(token);
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
    const token = (reply as any).generateCsrf?.();
    return reply.status(200).send({ csrfToken: token ?? null });
  });
}
