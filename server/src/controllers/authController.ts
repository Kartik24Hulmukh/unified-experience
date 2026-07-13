import type { FastifyRequest, FastifyReply } from 'fastify';
import { normalize } from '@/shared/response';
import {
  SignupInput,
  ResendOtpInput,
  VerifyOtpInput,
  LoginInput,
  GoogleSignInInput,
} from '@/shared/validation';
import * as authService from '@/services/authService';
import { env } from '@/config/env';
import { REFRESH_COOKIE } from '@/config/constants';

/* ── Per-email rate limiter (HIGH-C FIX) ────────────────────────────────────
 * The global @fastify/rate-limit is keyed by IP, so a distributed brute-force
 * attack (many IPs targeting one account) bypasses it. This in-memory sliding
 * window adds a second layer keyed by email address: max 15 attempts per 5 min.
 */
const EMAIL_RATE_WINDOW_MS = 5 * 60 * 1000;
const EMAIL_RATE_MAX = 15;

interface RateBucket { timestamps: number[] }
const emailRateMap = new Map<string, RateBucket>();

const emailRatePruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of emailRateMap) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
    if (bucket.timestamps.length === 0) emailRateMap.delete(key);
  }
}, EMAIL_RATE_WINDOW_MS);
emailRatePruneInterval.unref();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const bucket = emailRateMap.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
  if (bucket.timestamps.length >= EMAIL_RATE_MAX) return false;
  bucket.timestamps.push(now);
  emailRateMap.set(key, bucket);
  return true;
}

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

export async function signup(request: FastifyRequest, reply: FastifyReply) {
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
}

export async function resendOtp(request: FastifyRequest, reply: FastifyReply) {
  const { email } = request.body as { email: string };
  if (!checkEmailRateLimit(email)) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many resend attempts. Please wait.',
    });
  }

  const result = await authService.resendOtp(request.body as ResendOtpInput);
  return reply.status(200).send(result);
}

export async function verifyOtp(request: FastifyRequest, reply: FastifyReply) {
  const result = await authService.verifyOtp(request.body as VerifyOtpInput, {
    userAgent: request.headers['user-agent'],
    ipAddress: request.ip,
  });

  setRefreshCookie(reply, result.tokens.refreshToken);

  return reply.status(201).send(normalize({
    user: result.user,
    accessToken: result.tokens.accessToken,
  }));
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  const { email } = request.body as { email: string };
  if (!checkEmailRateLimit(email)) {
    return reply.status(429).send({
      error: 'Too Many Requests',
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
}

export async function googleSignIn(request: FastifyRequest, reply: FastifyReply) {
  const result = await authService.googleSignIn(request.body as GoogleSignInInput, {
    userAgent: request.headers['user-agent'],
    ipAddress: request.ip,
  });

  setRefreshCookie(reply, result.tokens.refreshToken);

  return reply.status(200).send(normalize({
    user: result.user,
    accessToken: result.tokens.accessToken,
  }));
}

export async function refresh(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[REFRESH_COOKIE.NAME];
  if (!token) {
    return reply.status(401).send({ error: 'Refresh token missing', code: 'UNAUTHORIZED' });
  }

  const result = await authService.refreshAccessToken(token, {
    userAgent: request.headers['user-agent'],
    ipAddress: request.ip,
  });

  const typedResult = result as {
    tokens?: { accessToken: string; refreshToken: string };
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
  };
  const accessToken = typedResult.tokens?.accessToken || typedResult.accessToken;
  const refreshToken = typedResult.tokens?.refreshToken || typedResult.refreshToken;
  const user = typedResult.user;

  setRefreshCookie(reply, refreshToken);

  return reply.status(200).send(normalize({
    user,
    accessToken,
  }));
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[REFRESH_COOKIE.NAME];
  if (token) {
    if (request.userId) {
      await authService.logout(token, request.userId);
    } else {
      await authService.logout(token);
    }
  }

  clearRefreshCookie(reply);
  return reply.status(200).send(normalize({ message: 'Logged out' }));
}

export async function me(request: FastifyRequest, reply: FastifyReply) {
  const result = await authService.getCurrentUser(request.userId!);
  const typedResult = result as { user?: unknown };
  if (typedResult && typedResult.user) {
    return reply.status(200).send(normalize(result));
  }
  return reply.status(200).send(normalize({ user: result }));
}