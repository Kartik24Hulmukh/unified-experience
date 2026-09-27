/**
 * RGIT Rozgar - Admin-reviewed campus answers (APODEX continuation k)
 *
 * Locks the contract of turning a demand gap into a DB-stored, cited answer:
 * validation (PII, citation, length), engine merge (static wins collisions,
 * the original student phrasing now matches), gap resolution, never-throw
 * refresh, and admin/public route wiring incl. the gaps limit=100 fix.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  gapUpsert: vi.fn(),
  gapFindMany: vi.fn(),
  gapUpdateMany: vi.fn(),
  answerFindMany: vi.fn(),
  answerUpsert: vi.fn(),
  answerUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const client = {
    campusQaGap: { upsert: mocks.gapUpsert, findMany: mocks.gapFindMany, updateMany: mocks.gapUpdateMany },
    campusQaAnswer: { findMany: mocks.answerFindMany, upsert: mocks.answerUpsert, update: mocks.answerUpdate },
  } as Record<string, unknown>;
  client.$transaction = (fn: (tx: unknown) => unknown) => fn(client);
  return { prisma: client };
});

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
  createReviewedAnswer,
  createReviewedAnswerSchema,
  deriveKeywords,
  ensureReviewedAnswersFresh,
  isValidSource,
  refreshReviewedAnswers,
  resetReviewedAnswersCache,
  reviewedSlug,
  setReviewedAnswerPublished,
  toKnowledgeEntry,
} from '@/services/campusQaCorpusService';
import { answerCampusQuestion, listCampusQuestions, setReviewedAnswers } from '@/services/campusQaService';
import { gapQueryHash } from '@/services/campusQaGapService';
import { CAMPUS_KNOWLEDGE } from '@/data/campusKnowledge';
import { buildApp } from '@/app';
import type { FastifyInstance } from 'fastify';

const GAP = 'photocopy xerox printout shop timings';
const VALID = {
  gapQuery: GAP,
  question: 'Where can I get photocopies near RGIT?',
  answer: 'The xerox and photocopy counter is at the stationery shop by the main gate, open 9am to 7pm on working days.',
  topic: 'directory' as const,
  source: 'docs/CAMPUS_GUIDE.md',
};
const row = (over: Record<string, unknown> = {}) => ({
  slug: reviewedSlug(VALID.question),
  question: VALID.question,
  answer: VALID.answer,
  topic: 'directory',
  keywords: deriveKeywords(VALID),
  source: VALID.source,
  ...over,
});

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});
afterAll(async () => {
  setReviewedAnswers([]);
  await app.close();
});
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  setReviewedAnswers([]);
  resetReviewedAnswersCache();
});

describe('validation contract', () => {
  it('accepts a cited, clean answer and trims whitespace', () => {
    const parsed = createReviewedAnswerSchema.parse({ ...VALID, question: `  ${VALID.question}   ` });
    expect(parsed.question).toBe(VALID.question);
  });

  it('rejects PII, missing citation, bad topic and thin answers', () => {
    expect(createReviewedAnswerSchema.safeParse({ ...VALID, answer: 'Email the shop owner at owner@example.com for bulk prints.' }).success).toBe(false);
    expect(createReviewedAnswerSchema.safeParse({ ...VALID, answer: 'Call 98200 12345 for the stationery shop timings today.' }).success).toBe(false);
    expect(createReviewedAnswerSchema.safeParse({ ...VALID, source: 'trust me' }).success).toBe(false);
    expect(createReviewedAnswerSchema.safeParse({ ...VALID, source: 'http://insecure.example.com' }).success).toBe(false);
    expect(createReviewedAnswerSchema.safeParse({ ...VALID, topic: 'gossip' }).success).toBe(false);
    expect(createReviewedAnswerSchema.safeParse({ ...VALID, answer: 'too short' }).success).toBe(false);
  });

  it('allows in-repo docs and https citations only', () => {
    expect(isValidSource('docs/SECURITY.md')).toBe(true);
    expect(isValidSource('https://www.mctrgit.ac.in/')).toBe(true);
    expect(isValidSource(['docs', '..', '..', 'etc', 'passwd'].join('/'))).toBe(false);
    expect(isValidSource('javascript:alert(1)')).toBe(false);
    expect(isValidSource('https://user:pw@evil.example')).toBe(false);
  });

  it('derives keywords from the student phrasing and slugs deterministically', () => {
    const kw = deriveKeywords(VALID);
    expect(kw).toEqual(expect.arrayContaining(['photocopy', 'xerox', 'shop']));
    expect(kw.length).toBeLessThanOrEqual(15);
    expect(reviewedSlug(VALID.question)).toBe(reviewedSlug(VALID.question));
    expect(reviewedSlug(VALID.question)).toMatch(/^[a-z0-9-]{1,80}$/);
  });
});

describe('engine merge', () => {
  it('an unanswerable gap becomes answerable once the reviewed answer is loaded', () => {
    expect(answerCampusQuestion(GAP).matched).toBe(false);
    setReviewedAnswers([toKnowledgeEntry(row())!]);
    const res = answerCampusQuestion(GAP);
    expect(res.matched).toBe(true);
    expect(res.entry?.id).toMatch(/^reviewed-/);
    expect(res.entry?.source).toBe(VALID.source);
    expect(listCampusQuestions().length).toBe(CAMPUS_KNOWLEDGE.length + 1);
  });

  it('static entries win id collisions and core intents are unaffected', () => {
    const hijack = { ...toKnowledgeEntry(row())!, id: CAMPUS_KNOWLEDGE[0].id };
    expect(setReviewedAnswers([hijack])).toBe(0);
    expect(answerCampusQuestion('how do I get verified as a student?').entry?.id).toBe('verify-student');
  });

  it('drops rows with an unknown topic', () => {
    expect(toKnowledgeEntry(row({ topic: 'gossip' }))).toBeNull();
  });
});

describe('persistence', () => {
  it('creates the answer, resolves the matching gap and reloads the engine', async () => {
    mocks.answerUpsert.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', ...row(), published: true });
    mocks.gapUpdateMany.mockResolvedValue({ count: 1 });
    mocks.answerFindMany.mockResolvedValue([row()]);
    const out = await createReviewedAnswer(createReviewedAnswerSchema.parse(VALID), 'admin-id');
    expect(out.resolvedGaps).toBe(1);
    expect(mocks.gapUpdateMany.mock.calls[0][0].where.queryHash).toBe(gapQueryHash(GAP));
    expect(answerCampusQuestion(GAP).matched).toBe(true);
  });

  it('refresh never throws and keeps the last good corpus when the DB fails', async () => {
    setReviewedAnswers([toKnowledgeEntry(row())!]);
    mocks.answerFindMany.mockRejectedValue(new Error('db down'));
    expect(await refreshReviewedAnswers()).toBe(-1);
    expect(answerCampusQuestion(GAP).matched).toBe(true);
  });

  it('TTL-gates refreshes on the public path', async () => {
    mocks.answerFindMany.mockResolvedValue([]);
    await ensureReviewedAnswersFresh();
    await ensureReviewedAnswersFresh();
    expect(mocks.answerFindMany).toHaveBeenCalledTimes(1);
  });

  it('unpublishing reopens linked gaps', async () => {
    mocks.answerUpdate.mockResolvedValue({ id: 'x', published: false });
    mocks.gapUpdateMany.mockResolvedValue({ count: 1 });
    mocks.answerFindMany.mockResolvedValue([]);
    await setReviewedAnswerPublished('x', false);
    expect(mocks.gapUpdateMany).toHaveBeenCalledWith({ where: { answerId: 'x' }, data: { resolvedAt: null } });
  });
});

describe('route wiring', () => {
  it('admin endpoints require authentication', async () => {
    for (const [method, url] of [['GET', '/api/admin/campus-qa/answers'], ['POST', '/api/admin/campus-qa/answers'], ['GET', '/api/admin/campus-qa/gaps?limit=100']] as const) {
      const res = await app.inject({ method, url, payload: method === 'POST' ? VALID : undefined });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it('public Q&A serves DB-reviewed answers and stays up when the DB is down', async () => {
    mocks.answerFindMany.mockResolvedValue([row()]);
    const ok = await app.inject({ method: 'GET', url: `/api/public/campus-qa?q=${encodeURIComponent(GAP)}` });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { data: { matched: boolean } }).data.matched).toBe(true);

    setReviewedAnswers([]);
    resetReviewedAnswersCache();
    mocks.answerFindMany.mockRejectedValue(new Error('db down'));
    mocks.gapUpsert.mockResolvedValue({});
    const degraded = await app.inject({ method: 'GET', url: '/api/public/campus-qa?q=how do i get verified as an rgit student' });
    expect(degraded.statusCode).toBe(200);
    expect((degraded.json() as { data: { matched: boolean } }).data.matched).toBe(true);
  });
});
