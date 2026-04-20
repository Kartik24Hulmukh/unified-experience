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

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import {
  signupSchema,
  resendOtpSchema,
  verifyOtpSchema,
  loginSchema,
  googleSignInSchema,
} from '@/shared/validation';
import * as authController from '@/controllers/authController';

function methodNotAllowed(allowedMethods: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const message = `Method ${request.method} not allowed. Allowed: ${allowedMethods.join(', ')}`;
    return reply
      .code(405)
      .header('Allow', allowedMethods.join(', '))
      .send({ statusCode: 405, error: 'Method Not Allowed', message });
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** POST /signup — initiate registration, send OTP */
  app.post(
    '/signup',
    { preValidation: validate(signupSchema) },
    authController.signup
  );

  /** POST /resend-otp — resend code to an email in the flow */
  app.post(
    '/resend-otp',
    { preValidation: validate(resendOtpSchema) },
    authController.resendOtp
  );

  /** POST /verify-otp — verify OTP and create account */
  app.post(
    '/verify-otp',
    { preValidation: validate(verifyOtpSchema) },
    authController.verifyOtp
  );

  /** POST /login — email/password authentication */
  app.post(
    '/login',
    { preValidation: validate(loginSchema) },
    authController.login
  );
  app.get('/login', methodNotAllowed(['POST']));

  /** POST /google — Google OAuth sign-in */
  app.post(
    '/google',
    { preValidation: validate(googleSignInSchema) },
    authController.googleSignIn
  );

  /** POST /refresh — exchange refresh token for new tokens */
  app.post('/refresh', authController.refresh);

  /** POST /logout — revoke token and clear cookie */
  app.post('/logout', authController.logout);

  /** GET /me — get current user profile */
  app.get('/me', { preHandler: authenticate }, authController.me);
}
