import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
const db = vi.hoisted(() => ({ analyticsEvent: { createMany: vi.fn(), deleteMany: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
import { analyticsRoutes } from '@/routes/analytics';
import { pruneAnalyticsEvents } from '@/services/analyticsService';
beforeEach(() => { vi.resetAllMocks(); db.analyticsEvent.createMany.mockResolvedValue({ count: 1 }); });
async function ingest(payload: unknown, userId?: string) {
  const app = Fastify();
  if (userId) app.addHook('onRequest', async req => { req.userId = userId; });
  await app.register(analyticsRoutes);
  try { return await app.inject({ method: 'POST', url: '/events', payload }); }
  finally { await app.close(); }
}
describe('Durable privacy-minimized analytics', () => {
  it('persists before acknowledging and discards all body identity / arbitrary data', async () => {
    const res = await ingest({ events: [{ name: 'page_view', properties: { email: 'private@example.com' }, context: { token: 'secret' }, user: { id: 'forged' } }] });
    expect(res.statusCode).toBe(202);
    const row = db.analyticsEvent.createMany.mock.calls[0][0].data[0];
    expect(row.userId).toBeNull();
    expect(Object.keys(row).sort()).toEqual(['level', 'name', 'occurredAt', 'userId']);
    expect(JSON.stringify(row)).not.toContain('private');
  });
  it('uses only authenticated identity', async () => {
    await ingest({ events: [{ name: 'request_sent', user: { id: 'forged' } }] }, 'real-user');
    expect(db.analyticsEvent.createMany.mock.calls[0][0].data[0].userId).toBe('real-user');
  });
  it.each([[], Array.from({ length: 101 }, () => ({ name: 'page_view' })), [{ name: 'email.alice' }]])('rejects invalid batches/names', async events => {
    expect((await ingest({ events })).statusCode).toBe(400);
    expect(db.analyticsEvent.createMany).not.toHaveBeenCalled();
  });
  it('does not acknowledge failed persistence', async () => {
    db.analyticsEvent.createMany.mockRejectedValue(new Error('DB unavailable'));
    expect((await ingest({ events: [{ name: 'page_view' }] })).statusCode).toBe(500);
  });
  it('bounds client timestamps', async () => {
    const start = Date.now();
    await ingest({ events: [{ name: 'page_view', timestamp: 1 }, { name: 'page_view', timestamp: 9999999999999 }] });
    const rows = db.analyticsEvent.createMany.mock.calls[0][0].data;
    expect(rows[0].occurredAt.getTime()).toBeGreaterThanOrEqual(start - 86400000);
    expect(rows[1].occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
  it('deletes only events older than 30 days', async () => {
    await pruneAnalyticsEvents(new Date('2026-09-27T00:00:00Z'));
    expect(db.analyticsEvent.deleteMany).toHaveBeenCalledWith({ where: { receivedAt: { lt: new Date('2026-08-28T00:00:00Z') } } });
  });
});
