/**
 * BErozgar — Health Route Tests
 *
 * Tests the GET /health and GET /health/ready endpoints.
 * Prisma is mocked to avoid requiring a running database.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// ── Mock Prisma BEFORE any app imports ──────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { count: vi.fn().mockResolvedValue(3) },
    listing: { count: vi.fn().mockResolvedValue(5) },
    request: { count: vi.fn().mockResolvedValue(2) },
    dispute: { count: vi.fn().mockResolvedValue(1) },
  },
}));

// ── Mock config/env to avoid missing env vars ──
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

import { buildApp } from '@/app';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns 200 with full health report when DB is connected', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.database).toBe('connected');
    expect(body.stores).toEqual({
      users: 3,
      listings: 5,
      requests: 2,
      disputes: 1,
    });
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 when DB is down', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('degraded');
    expect(body.database).toBe('disconnected');
  });
});

describe('GET /health/ready', () => {
  it('returns 200 when DB is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
  });

  it('returns 503 when DB is unreachable', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('timeout'));

    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.status).toBe('not_ready');
  });
});
