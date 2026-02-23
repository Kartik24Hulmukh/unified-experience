/**
 * BErozgar — Idempotency Middleware Tests
 *
 * Verifies that:
 *  1. First request stores the full response body (not `{}`)
 *  2. Replay of the same idempotency key returns cached body with replay header
 *  3. Expired keys are cleaned up and allow re-execution
 *  4. Requests without idempotency key are not cached
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ── Prisma mock with in-memory idempotency store ────────────
const idempotencyStore = new Map<
  string,
  { id: string; key: string; userId: string; responseStatus: number; responseBody: unknown; expiresAt: Date; createdAt: Date }
>();

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
    idempotencyKey: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        return Promise.resolve(idempotencyStore.get(where.key) ?? null);
      }),
      create: vi.fn().mockImplementation(({ data }: { data: any }) => {
        const entry = {
          id: crypto.randomUUID(),
          key: data.key,
          userId: data.userId,
          responseStatus: data.responseStatus,
          responseBody: data.responseBody,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
        };
        idempotencyStore.set(data.key, entry);
        return Promise.resolve(entry);
      }),
      delete: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        for (const [key, val] of idempotencyStore.entries()) {
          if (val.id === where.id) {
            idempotencyStore.delete(key);
            break;
          }
        }
        return Promise.resolve({});
      }),
    },
  },
}));

// ── Mock env ─────────────────────────────────────
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-for-unit-tests-32chars!',
    JWT_ACCESS_EXPIRES_IN: '15m',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5433/test',
    CORS_ORIGIN: 'http://localhost:8081',
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: '',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  },
}));

// ── Mock authService ─────────────────────────────
const MOCK_USER_ID = '00000000-0000-4000-a000-000000000001';

vi.mock('@/services/authService', () => ({
  signup: vi.fn(),
  verifyOtp: vi.fn(),
  login: vi.fn().mockResolvedValue({
    accessToken: 'mock-token',
    user: {
      id: '00000000-0000-4000-a000-000000000001',
      email: 'test@mctrgit.ac.in',
      name: 'Test User',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  }),
  googleSignIn: vi.fn(),
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

// ── Mock listingService (the mutating route we'll use for tests) ──
const CREATED_LISTING = {
  id: 'listing-abc-123',
  title: 'Physics Textbook',
  description: 'HC Verma Vol 1',
  price: 250,
  category: 'ACADEMIC',
  status: 'PENDING_REVIEW',
  sellerId: '00000000-0000-4000-a000-000000000001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('@/services/listingService', () => ({
  listListings: vi.fn(),
  getListing: vi.fn(),
  createListing: vi.fn().mockResolvedValue({
    id: 'listing-abc-123',
    title: 'Physics Textbook',
    description: 'HC Verma Vol 1',
    price: 250,
    category: 'ACADEMIC',
    status: 'PENDING_REVIEW',
    sellerId: '00000000-0000-4000-a000-000000000001',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }),
  updateListingStatus: vi.fn(),
}));

import { buildApp } from '@/app';
import * as listingService from '@/services/listingService';

const mockedListing = vi.mocked(listingService);

// ── JWT helper to create a valid token ───────────
import jwt from 'jsonwebtoken';

function makeToken(userId = MOCK_USER_ID): string {
  return jwt.sign(
    { sub: userId, email: 'test@mctrgit.ac.in', role: 'STUDENT' },
    'test-secret-key-for-unit-tests-32chars!',
    { expiresIn: '15m', algorithm: 'HS256' },
  );
}

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
  idempotencyStore.clear();
  // Re-wire the mock so createListing returns the same object every time
  mockedListing.createListing.mockResolvedValue(CREATED_LISTING);
});

/* ─── Idempotency Tests ──────────────────────────── */

describe('Idempotency Middleware', () => {
  const LISTING_PAYLOAD = {
    title: 'Physics Textbook',
    description: 'HC Verma Vol 1',
    price: 250,
    category: 'ACADEMIC',
  };

  it('stores the full response body on first request (not {})', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: {
        authorization: `Bearer ${makeToken()}`,
        'x-idempotency-key': 'key-001',
      },
      payload: LISTING_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe('listing-abc-123');

    // Verify the idempotency store has the FULL response body
    const compositeKey = `${MOCK_USER_ID}:key-001`;
    const cached = idempotencyStore.get(compositeKey);
    expect(cached).toBeDefined();
    expect(cached!.responseStatus).toBe(201);
    // The critical assertion: responseBody must NOT be {}
    expect(cached!.responseBody).not.toEqual({});
    expect((cached!.responseBody as any).data).toBeDefined();
    expect((cached!.responseBody as any).data.id).toBe('listing-abc-123');
  });

  it('replays cached response with x-idempotency-replay header', async () => {
    const token = makeToken();

    // First request — creates the listing
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': 'key-002',
      },
      payload: LISTING_PAYLOAD,
    });
    expect(res1.statusCode).toBe(201);
    expect(res1.headers['x-idempotency-replay']).toBeUndefined();

    // Second request — same key, should be a replay
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': 'key-002',
      },
      payload: LISTING_PAYLOAD,
    });

    expect(res2.statusCode).toBe(201);
    expect(res2.headers['x-idempotency-replay']).toBe('true');

    // Bodies must be identical
    const body1 = res1.json();
    const body2 = res2.json();
    expect(body2).toEqual(body1);

    // Service should only have been called ONCE (the replay bypasses it)
    expect(mockedListing.createListing).toHaveBeenCalledTimes(1);
  });

  it('cleans expired keys and re-executes the handler', async () => {
    const token = makeToken();
    const compositeKey = `${MOCK_USER_ID}:key-003`;

    // Manually insert an expired entry
    idempotencyStore.set(compositeKey, {
      id: 'expired-uuid',
      key: compositeKey,
      userId: MOCK_USER_ID,
      responseStatus: 201,
      responseBody: { data: { id: 'old-listing', title: 'Stale' } },
      expiresAt: new Date(Date.now() - 60_000), // expired 1 minute ago
      createdAt: new Date(Date.now() - 86_400_000),
    });

    // Send request with the same key — should detect expiry, delete, and re-execute
    const res = await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: {
        authorization: `Bearer ${token}`,
        'x-idempotency-key': 'key-003',
      },
      payload: LISTING_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    expect(res.headers['x-idempotency-replay']).toBeUndefined();

    const body = res.json();
    expect(body.data.id).toBe('listing-abc-123'); // Fresh, not 'old-listing'
    expect(mockedListing.createListing).toHaveBeenCalledTimes(1);
  });

  it('does not cache when no idempotency key is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: {
        authorization: `Bearer ${makeToken()}`,
      },
      payload: LISTING_PAYLOAD,
    });

    expect(res.statusCode).toBe(201);
    expect(idempotencyStore.size).toBe(0);
  });

  it('different idempotency keys yield separate cache entries', async () => {
    const token = makeToken();

    await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: { authorization: `Bearer ${token}`, 'x-idempotency-key': 'key-A' },
      payload: LISTING_PAYLOAD,
    });

    await app.inject({
      method: 'POST',
      url: '/api/listings',
      headers: { authorization: `Bearer ${token}`, 'x-idempotency-key': 'key-B' },
      payload: LISTING_PAYLOAD,
    });

    expect(idempotencyStore.size).toBe(2);
    expect(idempotencyStore.has(`${MOCK_USER_ID}:key-A`)).toBe(true);
    expect(idempotencyStore.has(`${MOCK_USER_ID}:key-B`)).toBe(true);
  });
});
