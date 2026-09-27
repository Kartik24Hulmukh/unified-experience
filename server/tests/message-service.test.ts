import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  request: { findUnique: vi.fn() }, user: { findUnique: vi.fn() },
  message: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  $queryRaw: vi.fn(), $transaction: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));
import { listMessages, sendMessage } from '@/services/messageService';
const input = { body: 'Library at 4pm?', clientId: 'f879fd78-b20e-4a78-87eb-47d99a0246a5' };
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(fn => fn(db));
  db.request.findUnique.mockResolvedValue({ buyerId: 'buyer', sellerId: 'seller', status: 'ACCEPTED' });
  db.user.findUnique.mockResolvedValue({ role: 'STUDENT_VERIFIED', isRestricted: false });
  db.message.findUnique.mockResolvedValue(null);
  db.message.findMany.mockResolvedValue([]);
  db.message.create.mockImplementation(({ data }) => ({ id: 'message', ...data }));
});
describe('Exchange thread access and retry contracts', () => {
  it.each(['buyer', 'seller'])('allows participant %s', async actor => {
    await expect(sendMessage('request', actor, input)).resolves.toMatchObject({ body: input.body });
    expect(db.$queryRaw).toHaveBeenCalled();
  });
  it('hides inaccessible and absent requests identically', async () => {
    await expect(listMessages('request', 'outsider')).rejects.toMatchObject({ statusCode: 404 });
    db.request.findUnique.mockResolvedValue(null);
    await expect(listMessages('request', 'buyer')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('allows admin review but not posting', async () => {
    db.user.findUnique.mockResolvedValue({ role: 'ADMIN', isRestricted: false });
    await expect(listMessages('request', 'admin')).resolves.toMatchObject({ messages: [] });
    await expect(sendMessage('request', 'admin', input)).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each(['CANCELLED', 'DISPUTED', 'COMPLETED', 'WITHDRAWN', 'RESOLVED', 'DECLINED'])('makes %s read-only', async status => {
    db.request.findUnique.mockResolvedValue({ buyerId: 'buyer', sellerId: 'seller', status });
    await expect(sendMessage('request', 'buyer', input)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.message.create).not.toHaveBeenCalled();
  });
  it.each([{ role: 'PUBLIC_USER', isRestricted: false }, { role: 'STUDENT_VERIFIED', isRestricted: true }])('rejects restricted/unverified posting', async user => {
    db.user.findUnique.mockResolvedValue(user);
    await expect(sendMessage('request', 'buyer', input)).rejects.toMatchObject({ statusCode: 403 });
  });
  it('returns same persisted message for retries without creating again', async () => {
    db.message.findUnique.mockResolvedValue({ id: 'existing', body: input.body });
    await expect(sendMessage('request', 'buyer', input)).resolves.toMatchObject({ id: 'existing' });
    expect(db.message.create).not.toHaveBeenCalled();
  });
  it('rejects key reuse with changed content', async () => {
    db.message.findUnique.mockResolvedValue({ id: 'existing', body: 'Different' });
    await expect(sendMessage('request', 'buyer', input)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('sanitizes stored content and rejects empty script-only messages', async () => {
    await expect(sendMessage('request', 'buyer', { ...input, body: '<script>alert(1)</script>Hello' })).resolves.toMatchObject({ body: 'Hello' });
    await expect(sendMessage('request', 'buyer', { ...input, body: '<script>alert(1)</script>' })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('returns bounded chronological pages with a stable older cursor', async () => {
    db.message.findMany.mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ id: String(51 - i) })));
    const result = await listMessages('request', 'buyer');
    expect(result.messages).toHaveLength(50);
    expect(result.messages[0].id).toBe('2');
    expect(result.nextCursor).toBe('2');
    expect(db.message.findMany.mock.calls[0][0].take).toBe(51);
  });
  it('rejects cross-thread or missing cursors', async () => {
    db.message.findFirst.mockResolvedValue(null);
    await expect(listMessages('request', 'buyer', 'other')).rejects.toMatchObject({ statusCode: 400 });
    expect(db.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other', requestId: 'request' } }));
  });
});
