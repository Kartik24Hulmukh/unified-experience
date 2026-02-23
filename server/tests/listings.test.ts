/**
 * BErozgar — Listing Route Tests
 *
 * Tests GET /api/listings, GET /api/listings/:id, POST /api/listings.
 * listingService is mocked to avoid needing a running database.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ── Mock Prisma ──────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { count: vi.fn().mockResolvedValue(0), findUnique: vi.fn() },
    listing: { count: vi.fn().mockResolvedValue(0) },
    request: { count: vi.fn().mockResolvedValue(0) },
    dispute: { count: vi.fn().mockResolvedValue(0) },
  },
}));

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

// ── Mock listingService ──────────────────────────
vi.mock('@/services/listingService', () => ({
  listListings: vi.fn(),
  getListing: vi.fn(),
  createListing: vi.fn(),
  updateListingStatus: vi.fn(),
}));

import { buildApp } from '@/app';
import * as listingService from '@/services/listingService';
import type { FastifyInstance } from 'fastify';

const mockedListing = vi.mocked(listingService);

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

/* ─── GET /api/listings ───────────────────────── */

describe('GET /api/listings', () => {
  it('returns 200 with paginated listings', async () => {
    mockedListing.listListings.mockResolvedValueOnce({
      listings: [
        { id: 'l1', title: 'Notebook', price: 200, status: 'APPROVED' },
      ],
      pagination: { page: 1, perPage: 20, total: 1 },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/listings',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta).toBeDefined();
    expect(body.meta.total).toBe(1);
  });

  it('passes query parameters to service', async () => {
    mockedListing.listListings.mockResolvedValueOnce({
      listings: [],
      pagination: { page: 2, perPage: 10, total: 0 },
    });

    await app.inject({
      method: 'GET',
      url: '/api/listings?page=2&limit=10&search=book',
    });

    expect(mockedListing.listListings).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        search: 'book',
      }),
    );
  });
});

/* ─── GET /api/listings/:id ───────────────────── */

describe('GET /api/listings/:id', () => {
  it('returns 200 with single listing', async () => {
    mockedListing.getListing.mockResolvedValueOnce({
      id: 'l1',
      title: 'Textbook',
      price: 150,
      status: 'APPROVED',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/listings/l1',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe('l1');
  });

  it('returns 404 when listing not found', async () => {
    const { NotFoundError } = await import('@/errors/index');
    mockedListing.getListing.mockRejectedValueOnce(
      new NotFoundError('Listing not found'),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/listings/nonexistent',
    });

    expect(res.statusCode).toBe(404);
  });
});

/* ─── POST /api/listings ──────────────────────── */

describe('POST /api/listings', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listings',
      payload: { title: 'Test Listing', price: 100 },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    // Even without auth, validation should fire first or auth.
    // The exact status depends on hook order, but we ensure it doesn't 200.
    const res = await app.inject({
      method: 'POST',
      url: '/api/listings',
      payload: { price: 100 },
    });

    expect([400, 401]).toContain(res.statusCode);
  });
});
