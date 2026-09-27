import { prisma } from '@/lib/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/errors/index';
import { sanitizeString } from '@/plugins/sanitize';
import type { Prisma } from '@prisma/client';

const writableStates = new Set(['SENT', 'ACCEPTED', 'MEETING_SCHEDULED']);
const selection = { id: true, requestId: true, senderId: true, body: true, createdAt: true } as const;

async function authorizeThread(tx: Prisma.TransactionClient, requestId: string, userId: string, write: boolean) {
  const [thread, user] = await Promise.all([
    tx.request.findUnique({ where: { id: requestId }, select: { buyerId: true, sellerId: true, status: true } }),
    tx.user.findUnique({ where: { id: userId }, select: { role: true, isRestricted: true } }),
  ]);
  if (!user || user.isRestricted) throw new ForbiddenError('Thread access denied');
  const participant = thread && (thread.buyerId === userId || thread.sellerId === userId);
  // Identical response for missing and inaccessible threads: no existence oracle.
  if (!thread || (!participant && user.role !== 'ADMIN')) throw new NotFoundError('Thread');
  // Admins may review but may not impersonate a participant or inject messages.
  if (write && (!participant || user.role !== 'STUDENT_VERIFIED')) throw new ForbiddenError('Only verified exchange participants can send messages');
  return thread;
}

export async function listMessages(requestId: string, userId: string, before?: string) {
  return prisma.$transaction(async tx => {
    await authorizeThread(tx, requestId, userId, false);
    const cursor = before ? await tx.message.findFirst({ where: { id: before, requestId }, select: { id: true, createdAt: true } }) : null;
    if (before && !cursor) throw new ValidationError('Invalid message cursor');
    const rows = await tx.message.findMany({
      where: { requestId, ...(cursor ? { OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51, select: selection,
    });
    const hasMore = rows.length > 50;
    const page = rows.slice(0, 50);
    return { messages: page.reverse(), nextCursor: hasMore ? page[0].id : null };
  });
}

export async function sendMessage(requestId: string, userId: string, input: { body: string; clientId: string }) {
  const body = sanitizeString(input.body).trim();
  if (!body || body.length > 2000) throw new ValidationError('Message must contain 1 to 2000 characters');
  return prisma.$transaction(async tx => {
    // Serialize with FSM updates so a message cannot race a closed/disputed state.
    await tx.$queryRaw`SELECT id FROM requests WHERE id = ${requestId}::uuid FOR UPDATE`;
    const thread = await authorizeThread(tx, requestId, userId, true);
    const key = { requestId, senderId: userId, clientId: input.clientId };
    const existing = await tx.message.findUnique({ where: { requestId_senderId_clientId: key }, select: selection });
    if (existing) {
      if (existing.body !== body) throw new ConflictError('Message retry key already used for different content');
      return existing;
    }
    if (!writableStates.has(thread.status)) throw new ConflictError('This exchange thread is read-only');
    return tx.message.create({ data: { ...key, body }, select: selection });
  });
}
