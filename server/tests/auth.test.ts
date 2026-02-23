/**
 * BErozgar — Auth Route Tests
 *
 * Tests login, signup, refresh, logout, and /me endpoints.
 * Auth service is mocked so tests run without a database.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ── Mock Prisma ──────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    listing: { count: vi.fn().mockResolvedValue(0) },
    request: { count: vi.fn().mockResolvedValue(0) },
    dispute: { count: vi.fn().mockResolvedValue(0) },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn(),
    },
    otp: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

// ── Mock env ──────────────────────────────────────
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-for-unit-tests-32chars!',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5433/test',
    CORS_ORIGIN: 'http://localhost:8081',
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: '',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  },
}));

// ── Mock authService (avoid real DB + token issuance) ──
vi.mock('@/services/authService', () => ({
  signup: vi.fn(),
  verifyOtp: vi.fn(),
  login: vi.fn(),
  googleSignIn: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { buildApp } from '@/app';
import * as authService from '@/services/authService';
import type { FastifyInstance } from 'fastify';

const mockedAuth = vi.mocked(authService);

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── Login ───────────────────────────────────── */

describe('POST /api/auth/login', () => {
  it('returns 200 with user and access token on valid credentials', async () => {
    mockedAuth.login.mockResolvedValueOnce({
      user: { id: 'u1', email: 'test@mctrgit.ac.in', fullName: 'Test User', role: 'STUDENT' },
      tokens: { accessToken: 'access123', refreshToken: 'refresh456' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@mctrgit.ac.in', password: 'Secure@1234' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBe('access123');
    expect(body.user).toBeDefined();
  });

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'Secure@1234' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@mctrgit.ac.in', password: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when auth service throws UnauthorizedError', async () => {
    const { UnauthorizedError } = await import('@/errors/index');
    mockedAuth.login.mockRejectedValueOnce(
      new UnauthorizedError('Invalid email or password'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'wrong@mctrgit.ac.in', password: 'WrongPass1' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toContain('Invalid');
  });
});

/* ─── Signup ──────────────────────────────────── */

describe('POST /api/auth/signup', () => {
  it('returns 200 on valid signup request', async () => {
    mockedAuth.signup.mockResolvedValueOnce({
      message: 'OTP sent to email',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        fullName: 'New Student',
        email: 'new@mctrgit.ac.in',
        password: 'Secure@1234',
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it('rejects signup with invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        fullName: 'New Student',
        email: 'not-an-email',
        password: 'Secure@1234',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects signup with short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload: {
        fullName: 'New Student',
        email: 'new@example.com',
        password: 'short',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

/* ─── Logout ──────────────────────────────────── */

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the cookie', async () => {
    mockedAuth.logout.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { refresh_token: 'some-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().message).toBe('Logged out');
  });

  it('returns 200 even without a refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(res.statusCode).toBe(200);
  });
});

/* ─── Refresh ─────────────────────────────────── */

describe('POST /api/auth/refresh', () => {
  it('returns new tokens when valid refresh cookie is provided', async () => {
    mockedAuth.refreshAccessToken.mockResolvedValueOnce({
      accessToken: 'newAccess',
      refreshToken: 'newRefresh',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: 'valid-old-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBe('newAccess');
  });

  it('returns 401 when no refresh token is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
  });
});

/* ─── GET /me ─────────────────────────────────── */

describe('GET /api/auth/me', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    // Should be 401 since no Bearer token
    expect(res.statusCode).toBe(401);
  });
});
