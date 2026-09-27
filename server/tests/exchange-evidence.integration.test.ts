/** Real PostgreSQL + full Fastify plugin stack. Opt in with INTEGRATION_DATABASE_URL.
 * Uses synthetic rows only; cleanup is scoped to IDs created by this test.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
const url = process.env.INTEGRATION_DATABASE_URL;
describe.skipIf(!url)('Exchange evidence PostgreSQL integration', () => {
  let app: Awaited<ReturnType<typeof import('../src/app').buildApp>>;
  let db: typeof import('../src/lib/prisma').prisma;
  let sign: typeof import('../src/lib/jwt').signAccessToken;
  const buyer = randomUUID(), seller = randomUUID(), outsider = randomUUID(), admin = randomUUID();
  const listing = randomUUID(), request = randomUUID();
  const csrf = 'integration-csrf-token';
  const headers = (id = buyer, role = 'STUDENT_VERIFIED') => ({
    authorization: `Bearer ${sign({ sub: id, email: `${id}@example.invalid`, role })}`,
    cookie: `_csrf=${csrf}`, 'x-csrf-token': csrf,
  });
  const messageUrl = `/api/requests/${request}/messages`;
  beforeAll(async () => {
    Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', CSRF_ENFORCE: 'true', COOKIE_SECURE: 'false',
      JWT_SECRET: 'integration-only-not-a-production-secret-32chars', CORS_ORIGIN: 'http://localhost:8080' });
    db = (await import('../src/lib/prisma')).prisma;
    sign = (await import('../src/lib/jwt')).signAccessToken;
    app = await (await import('../src/app')).buildApp();
    await db.user.createMany({ data: [buyer, seller, outsider, admin].map(id => ({
      id, email: `${id}@example.invalid`, fullName: 'Synthetic integration participant', verified: true,
      role: id === admin ? 'ADMIN' as const : 'STUDENT_VERIFIED' as const,
    })) });
    await db.listing.create({ data: { id: listing, ownerId: seller, title: 'Synthetic test book', status: 'APPROVED' } });
    await db.request.create({ data: { id: request, listingId: listing, buyerId: buyer, sellerId: seller, status: 'ACCEPTED' } });
  });
  afterAll(async () => {
    if (db) {
      await db.analyticsEvent.deleteMany({ where: { userId: { in: [buyer, seller, outsider, admin] } } });
      await db.listing.deleteMany({ where: { id: listing } });
      await db.user.deleteMany({ where: { id: { in: [buyer, seller, outsider, admin] } } });
    }
    await app?.close(); await db?.$disconnect();
  });
  it('requires authentication and CSRF', async () => {
    expect((await app.inject({ url: messageUrl })).statusCode).toBe(401);
    const res = await app.inject({ method: 'POST', url: messageUrl, headers: { authorization: headers().authorization }, payload: { body: 'Hello', clientId: randomUUID() } });
    expect(res.statusCode).toBe(403);
  });
  it('serializes concurrent duplicate sends into one row and lets the seller read it', async () => {
    const payload = { body: 'Meet at the library at 4pm?', clientId: randomUUID() };
    const responses = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: messageUrl, headers: headers(), payload })));
    for (const res of responses) expect(res.statusCode, res.body).toBe(201);
    expect(responses[0].json().data.id).toBe(responses[1].json().data.id);
    expect(await db.message.count({ where: { requestId: request } })).toBe(1);
    const read = await app.inject({ url: messageUrl, headers: headers(seller) });
    expect(read.statusCode, read.body).toBe(200);
    expect(read.json().data.messages[0].body).toBe(payload.body);
  });
  it('rejects outsider access, permits read-only admin review, and validates IDs', async () => {
    expect((await app.inject({ url: messageUrl, headers: headers(outsider) })).statusCode).toBe(404);
    expect((await app.inject({ url: messageUrl, headers: headers(admin, 'ADMIN') })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: messageUrl, headers: headers(admin, 'ADMIN'), payload: { body: 'Not a participant', clientId: randomUUID() } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/requests/invalid/messages', headers: headers() })).statusCode).toBe(400);
  });
  it('stores safe text and paginates without overlap', async () => {
    const res = await app.inject({ method: 'POST', url: messageUrl, headers: headers(), payload: { body: '<script>alert(1)</script>Hello', clientId: randomUUID() } });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().data.body).toBe('Hello');
    await db.message.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ requestId: request, senderId: seller, clientId: randomUUID(), body: `Earlier message ${i}` })) });
    const first = (await app.inject({ url: messageUrl, headers: headers() })).json().data;
    expect(first.messages).toHaveLength(50);
    const second = (await app.inject({ url: `${messageUrl}?before=${first.nextCursor}`, headers: headers() })).json().data;
    expect(second.messages).toHaveLength(7);
    expect(new Set([...first.messages, ...second.messages].map(m => m.id)).size).toBe(57);
  });
  it('closes the composer after completion while retaining readable history', async () => {
    await db.request.update({ where: { id: request }, data: { status: 'COMPLETED' } });
    expect((await app.inject({ method: 'POST', url: messageUrl, headers: headers(), payload: { body: 'Too late', clientId: randomUUID() } })).statusCode).toBe(409);
    expect((await app.inject({ url: messageUrl, headers: headers() })).statusCode).toBe(200);
  });
  it('serializes competing FSM cancellation side effects', async () => {
    await db.request.update({ where: { id: request }, data: { status: 'ACCEPTED' } });
    const { updateRequestEvent } = await import('../src/services/requestService');
    const results = await Promise.allSettled([1, 2].map(() => updateRequestEvent(request, { event: 'CANCEL' }, buyer, 'STUDENT_VERIFIED')));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: buyer } })).cancelledRequests).toBe(1);
    await db.request.update({ where: { id: request }, data: { status: 'COMPLETED' } });
  });
  it('persists telemetry, denies non-admin reporting, and returns factual activity', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/analytics/events', headers: headers(), payload: { events: [{ name: 'exchange_completed', properties: { email: 'do-not-store@example.invalid' } }] } });
    expect(res.statusCode, res.body).toBe(202);
    expect(await db.analyticsEvent.count({ where: { userId: buyer } })).toBe(1);
    expect((await app.inject({ url: '/api/admin/analytics/funnel', headers: headers() })).statusCode).toBe(403);
    const summary = await app.inject({ url: '/api/admin/analytics/funnel?days=7', headers: headers(admin, 'ADMIN') });
    expect(summary.statusCode, summary.body).toBe(200);
    expect(summary.json().data.completedRequests).toBeGreaterThanOrEqual(1);
    expect(summary.json().data.methodology).toContain('not sequential cohort');
    expect((await app.inject({ url: '/api/admin/analytics/funnel?days=99', headers: headers(admin, 'ADMIN') })).statusCode).toBe(400);
  });
});
