/**
 * BErozgar — Input Sanitization Tests
 *
 * Tests the sanitizeString utility and the sanitize plugin preHandler.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// ── Mock Prisma ──────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { count: vi.fn().mockResolvedValue(0) },
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

import { sanitizeString } from '@/plugins/sanitize';

/* ═══════════════════════════════════════════════════
   Unit: sanitizeString
   ═══════════════════════════════════════════════════ */

describe('sanitizeString', () => {
  it('passes through clean text unchanged', () => {
    expect(sanitizeString('Hello, World!')).toBe('Hello, World!');
    expect(sanitizeString('Price is $50 & free delivery')).toBe(
      'Price is $50 & free delivery',
    );
  });

  it('strips <script> tags and their contents', () => {
    const input = 'Hi<script>alert("xss")</script>Bye';
    const result = sanitizeString(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  it('strips dangerous tags: iframe, object, embed', () => {
    expect(sanitizeString('<iframe src="evil.com"></iframe>')).not.toContain(
      'iframe',
    );
    expect(sanitizeString('<object data="x"></object>')).not.toContain(
      'object',
    );
    expect(sanitizeString('<embed src="x">')).not.toContain('embed');
  });

  it('strips event handler attributes', () => {
    const input = '<img onerror="alert(1)" src="x">';
    const result = sanitizeString(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('strips javascript: protocol', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeString(input);
    expect(result).not.toContain('javascript:');
  });

  it('strips data:text/html payloads', () => {
    const result = sanitizeString(
      'data:text/html,<script>alert(1)</script>',
    );
    expect(result).not.toContain('data:text/html');
    expect(result).not.toContain('<script');
  });

  it('handles empty strings', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('preserves normal HTML entities', () => {
    expect(sanitizeString('5 &gt; 3')).toBe('5 &gt; 3');
  });
});

/* ═══════════════════════════════════════════════════
   Integration: sanitize plugin on app
   ═══════════════════════════════════════════════════ */

import { buildApp } from '@/app';
import type { FastifyInstance } from 'fastify';

describe('sanitize plugin (app-level)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Register a test-only route that echoes the sanitized body
    app.post('/test-sanitize', async (request, reply) => {
      return reply.send(request.body);
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanitizes string fields in JSON request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-sanitize',
      payload: {
        title: 'Notebook <script>alert(1)</script>',
        price: 200,
      },
    });

    const body = res.json();
    expect(body.title).not.toContain('<script');
    expect(body.title).toContain('Notebook');
    expect(body.price).toBe(200);
  });

  it('sanitizes nested objects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-sanitize',
      payload: {
        user: {
          name: '<iframe src="evil.com">injected</iframe>',
        },
      },
    });

    const body = res.json();
    expect(body.user.name).not.toContain('iframe');
  });

  it('sanitizes arrays of strings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-sanitize',
      payload: {
        tags: ['safe', '<script>bad</script>'],
      },
    });

    const body = res.json();
    expect(body.tags[0]).toBe('safe');
    expect(body.tags[1]).not.toContain('<script');
  });
});
