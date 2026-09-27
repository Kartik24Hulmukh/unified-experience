/**
 * BErozgar - Campus Q&A gap logging tests (APODEX continuation i)
 *
 * Covers the privacy contract of the unmatched-query demand signal AND the
 * public route wiring: honest refusals aggregate, answered queries and
 * PII-shaped queries never do, and a storage failure can never degrade the
 * public Q&A response.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campusQaGap: { upsert: mocks.upsert, findMany: mocks.findMany },
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

import {
  normalizeGapQuery,
  gapQueryHash,
  recordUnmatchedQuery,
  MAX_GAP_QUERY_LENGTH,
} from '@/services/campusQaGapService';
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

describe('normalizeGapQuery privacy contract', () => {
  it('normalizes case, whitespace and caps length', () => {
    expect(normalizeGapQuery('  Where   DO I meet   for HANDOVER?  ')).toBe('where do i meet for handover?');
    const long = 'word '.repeat(80);
    expect(normalizeGapQuery(long)!.length).toBeLessThanOrEqual(MAX_GAP_QUERY_LENGTH);
  });

  it('drops emails, phone numbers and id-number runs outright', () => {
    expect(normalizeGapQuery('contact me at student@rgit.ac.in please')).toBeNull();
    expect(normalizeGapQuery('call me on 98200 12345 for handover')).toBeNull();
    expect(normalizeGapQuery('my aadhaar is 123456789012 what now')).toBeNull();
  });

  it('rejects single-token and empty queries', () => {
    expect(normalizeGapQuery('mess')).toBeNull();
    expect(normalizeGapQuery('')).toBeNull();
    expect(normalizeGapQuery('   ')).toBeNull();
  });

  it('hashes deterministically', () => {
    expect(gapQueryHash('where do i meet')).toBe(gapQueryHash('where do i meet'));
    expect(gapQueryHash('where do i meet')).not.toBe(gapQueryHash('where do i eat'));
  });
});

describe('recordUnmatchedQuery', () => {
  it('upserts the normalized query by hash and never throws on storage failure', async () => {
    mocks.upsert.mockClear().mockResolvedValue({});
    expect(await recordUnmatchedQuery('How do I return a borrowed calculator?')).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const call = mocks.upsert.mock.calls[0][0];
    expect(call.where.queryHash).toBe(gapQueryHash('how do i return a borrowed calculator?'));
    expect(call.create.queryText).toBe('how do i return a borrowed calculator?');
    expect(call.update.hits).toEqual({ increment: 1 });

    mocks.upsert.mockClear();
    mocks.upsert.mockRejectedValueOnce(new Error('db down'));
    expect(await recordUnmatchedQuery('some unmatched demand signal here')).toBe(false);
  });

  it('never stores PII-shaped or thin queries', async () => {
    mocks.upsert.mockClear().mockResolvedValue({});
    expect(await recordUnmatchedQuery('email me at me@x.com')).toBe(false);
    expect(await recordUnmatchedQuery('hi')).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe('public campus-qa route gap wiring', () => {
  it('aggregates honest refusals but never answered or PII queries', async () => {
    mocks.upsert.mockClear().mockResolvedValue({});

    // Answered query: no gap row.
    const answered = await app.inject({ method: 'GET', url: '/api/public/campus-qa?q=how do i get verified as an rgit student' });
    expect(answered.statusCode).toBe(200);
    expect((answered.json() as { data: { matched: boolean } }).data.matched).toBe(true);
    expect(mocks.upsert).not.toHaveBeenCalled();

    // Unmatched query: exactly one gap row.
    const refused = await app.inject({ method: 'GET', url: '/api/public/campus-qa?q=quantum flux capacitor checkout policy' });
    expect(refused.statusCode).toBe(200);
    expect((refused.json() as { data: { matched: boolean } }).data.matched).toBe(false);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    // PII-shaped unmatched query: refused but NOT stored.
    mocks.upsert.mockClear();
    const pii = await app.inject({ method: 'GET', url: '/api/public/campus-qa?q=please call 9820012345 about refund' });
    expect(pii.statusCode).toBe(200);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
