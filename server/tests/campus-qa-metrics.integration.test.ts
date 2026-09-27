/** Real PostgreSQL, migrations, JWT/admin authorization and concurrent transitions. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
const url = process.env.INTEGRATION_DATABASE_URL;
describe.skipIf(!url)('Campus Q&A evidence PostgreSQL integration', () => {
  let app: Awaited<ReturnType<typeof import('../src/app').buildApp>>;
  let db: typeof import('../src/lib/prisma').prisma;
  let metrics: typeof import('../src/services/campusQaMetricsService');
  let gaps: typeof import('../src/services/campusQaGapService');
  let sign: typeof import('../src/lib/jwt').signAccessToken;
  const admin = randomUUID(), student = randomUUID(), gapId = randomUUID();
  const query = `synthetic library policy ${gapId.replace(/[0-9-]/g, 'x')}`;
  // Isolated historical metric dates; never delete other dates during cleanup.
  const day = new Date('2001-01-01T00:00:00Z');
  let reopenedBefore = 0;
  const headers = (id: string, role: 'ADMIN' | 'STUDENT_VERIFIED') => ({
    authorization: `Bearer ${sign({ sub: id, email: `${id}@example.invalid`, role })}`,
  });
  beforeAll(async () => {
    Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', COOKIE_SECURE: 'false',
      JWT_SECRET: 'integration-only-not-a-production-secret-32chars', CORS_ORIGIN: 'http://localhost:8080' });
    db = (await import('../src/lib/prisma')).prisma;
    metrics = await import('../src/services/campusQaMetricsService');
    gaps = await import('../src/services/campusQaGapService');
    sign = (await import('../src/lib/jwt')).signAccessToken;
    app = await (await import('../src/app')).buildApp();
    await db.user.createMany({ data: [admin, student].map(id => ({ id, email: `${id}@example.invalid`, fullName: 'Synthetic QA reviewer', verified: true, role: id === admin ? 'ADMIN' as const : 'STUDENT_VERIFIED' as const })) });
    await db.campusQaGap.create({ data: { id: gapId, queryHash: gaps.gapQueryHash(query), queryText: query, resolvedAt: new Date() } });
    reopenedBefore = (await db.campusQaDailyMetric.findUnique({ where: { day: metrics.utcDay(new Date()) } }))?.reopened ?? 0;
  });
  afterAll(async () => {
    if (db) {
      await db.campusQaGap.deleteMany({ where: { id: gapId } });
      await db.campusQaDailyMetric.deleteMany({ where: { day } });
      // Integration DB only. Leave today's aggregate intact, as it may also contain other tests' observations.
      await db.user.deleteMany({ where: { id: { in: [admin, student] } } });
    }
    await app?.close(); await db?.$disconnect();
  });
  it('atomically preserves every concurrent outcome increment', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => metrics.recordCampusQaOutcome(i < 7, day)));
    expect(results.every(Boolean)).toBe(true);
    expect(await db.campusQaDailyMetric.findUnique({ where: { day } })).toMatchObject({ answered: 7, unanswered: 13 });
  });
  it('reopens a resolved gap exactly once under concurrent refusals', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => gaps.recordUnmatchedQuery(query)));
    expect(results.every(Boolean)).toBe(true);
    expect(await db.campusQaGap.findUnique({ where: { id: gapId } })).toMatchObject({ hits: 11, resolvedAt: null });
    const after = await db.campusQaDailyMetric.findUnique({ where: { day: metrics.utcDay(new Date()) } });
    expect(after?.reopened).toBe(reopenedBefore + 1);
    // A later genuine resolution followed by refusal is a second transition.
    await db.campusQaGap.update({ where: { id: gapId }, data: { resolvedAt: new Date() } });
    expect(await gaps.recordUnmatchedQuery(query)).toBe(true);
    expect((await db.campusQaDailyMetric.findUnique({ where: { day: metrics.utcDay(new Date()) } }))?.reopened).toBe(reopenedBefore + 2);
  });
  it('enforces admin authorization and validates bounded week windows', async () => {
    const endpoint = '/api/admin/campus-qa/metrics';
    expect((await app.inject({ url: endpoint })).statusCode).toBe(401);
    expect((await app.inject({ url: endpoint, headers: headers(student, 'STUDENT_VERIFIED') })).statusCode).toBe(403);
    for (const weeks of ['0', '13', '1.5', 'bogus']) {
      expect((await app.inject({ url: `${endpoint}?weeks=${weeks}`, headers: headers(admin, 'ADMIN') })).statusCode).toBe(400);
    }
    const response = await app.inject({ url: `${endpoint}?weeks=8`, headers: headers(admin, 'ADMIN') });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.json().data.weeks).toHaveLength(8);
    expect(response.body).not.toContain(query);
  });
  it('persists public outcomes, bypasses caches and excludes invalid requests', async () => {
    const today = metrics.utcDay(new Date());
    const before = await db.campusQaDailyMetric.findUnique({ where: { day: today } });
    const response = await app.inject({ url: '/api/public/campus-qa?q=how%20do%20i%20get%20verified%20as%20a%20student' });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().data.matched).toBe(true);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect((await app.inject({ url: '/api/public/campus-qa?q=' })).statusCode).toBe(400);
    const after = await db.campusQaDailyMetric.findUnique({ where: { day: today } });
    expect(after?.answered).toBe((before?.answered ?? 0) + 1);
    expect(after?.unanswered).toBe(before?.unanswered ?? 0);
  });
});
