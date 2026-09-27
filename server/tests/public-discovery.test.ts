/**
 * BErozgar — Listing Route Tests
 *
 * APODEX public-discovery + listing visibility hardening tests.
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
  listPublicListings: vi.fn(),
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


describe('APODEX-PD1: GET /api/listings visibility', () => {
  it('restricts anonymous browse without status to public statuses only', async () => {
    mockedListing.listListings.mockResolvedValueOnce({ listings: [], pagination: { hasNextPage: false } } as never);
    const res = await app.inject({ method: 'GET', url: '/api/listings' });
    expect(res.statusCode).toBe(200);
    const args = mockedListing.listListings.mock.calls[0][0] as { statuses?: string[] };
    expect(args.statuses).toEqual(['APPROVED', 'INTEREST_RECEIVED', 'IN_TRANSACTION', 'COMPLETED']);
    expect(args.statuses).not.toContain('PENDING_REVIEW');
  });

  it.each(['pending_review', 'rejected', 'flagged', 'removed', 'draft'])(
    'rejects anonymous request for moderation status %s with 403',
    async (st) => {
      const res = await app.inject({ method: 'GET', url: `/api/listings?status=${st}` });
      expect(res.statusCode).toBe(403);
      expect(mockedListing.listListings).not.toHaveBeenCalled();
    },
  );

  it('allows anonymous status=approved', async () => {
    mockedListing.listListings.mockResolvedValueOnce({ listings: [], pagination: {} } as never);
    const res = await app.inject({ method: 'GET', url: '/api/listings?status=approved' });
    expect(res.statusCode).toBe(200);
  });
});

describe('APODEX-PD2/PD3: GET /api/listings/:id visibility', () => {
  it('returns uniform 404 for a pending listing to anonymous viewers', async () => {
    mockedListing.getListing.mockResolvedValueOnce({ id: 'l1', status: 'PENDING_REVIEW', ownerId: 'u1', requests: [] } as never);
    const res = await app.inject({ method: 'GET', url: '/api/listings/l1' });
    expect(res.statusCode).toBe(404);
  });

  it('strips request rows (buyer ids) for anonymous viewers', async () => {
    mockedListing.getListing.mockResolvedValueOnce({
      id: 'l2', status: 'APPROVED', ownerId: 'u1',
      requests: [{ id: 'r1', buyerId: 'buyer-secret', status: 'SENT' }],
    } as never);
    const res = await app.inject({ method: 'GET', url: '/api/listings/l2' });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('buyer-secret');
    expect(JSON.parse(res.body).data.requests).toEqual([]);
    expect(res.headers['cache-control']).toContain('no-store');
  });
});

describe('APODEX-PD4: GET /api/public/listings', () => {
  it('returns narrow DTO with public cache headers', async () => {
    mockedListing.listPublicListings.mockResolvedValueOnce({
      items: [{ id: 'l1', title: 'Drafter', category: 'tools', module: 'RESALE', price: '300', status: 'APPROVED', createdAt: '2026-09-27T00:00:00.000Z' }],
      nextCursor: null,
    });
    const res = await app.inject({ method: 'GET', url: '/api/public/listings?module=resale&search=drafter' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(Object.keys(body.data[0]).sort()).toEqual(['category', 'createdAt', 'id', 'module', 'price', 'status', 'title']);
    expect(res.headers['cache-control']).toContain('public');
    expect(mockedListing.listPublicListings).toHaveBeenCalledWith(expect.objectContaining({ module: 'RESALE', search: 'drafter' }));
  });

  it('rejects invalid module and cursor', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/public/listings?module=weapons' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/public/listings?cursor=abc' })).statusCode).toBe(400);
    expect(mockedListing.listPublicListings).not.toHaveBeenCalled();
  });
});
