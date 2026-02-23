/**
 * BErozgar — Idempotency Middleware
 *
 * Prevents duplicate mutations by caching responses keyed by
 * (userId + idempotency-key). Uses the IdempotencyKey table.
 *
 * Two hooks must be registered together:
 *   - `idempotency`            (preHandler) — checks / replays cached responses
 *   - `idempotencyCacheResponse` (onSend)   — stores new responses for future replay
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@/lib/prisma';
import { IDEMPOTENCY } from '@/config/constants';
import { IdempotencyConflictError } from '@/errors/index';

/**
 * preHandler — check for an existing cached response and replay it,
 * or mark the request for caching in the onSend hook.
 */
export async function idempotency(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const key = request.headers[IDEMPOTENCY.KEY_HEADER] as string | undefined;
  if (!key) return; // No idempotency requested

  const userId = request.userId;
  if (!userId) return; // Unauthenticated requests can't use idempotency

  const compositeKey = `${userId}:${key}`;

  // Check for existing entry
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: compositeKey },
  });

  if (existing) {
    if (existing.expiresAt > new Date()) {
      // Return cached response
      reply
        .status(existing.responseStatus)
        .headers({ 'x-idempotency-replay': 'true' })
        .send(existing.responseBody);
      return;
    }

    // Expired — delete and proceed
    await prisma.idempotencyKey.delete({
      where: { id: existing.id },
    });
  }

  // Mark this request for the onSend hook to cache
  (request as any)._idempotencyKey = compositeKey;
  (request as any)._idempotencyUserId = userId;
}

/**
 * onSend — if the request was marked by the preHandler, store the
 * serialized response body so future replays return the real payload.
 * Register this ONCE at the same encapsulation level as the preHandler.
 */
export async function idempotencyCacheResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: string | Buffer | null,
): Promise<typeof payload> {
  const compositeKey = (request as any)._idempotencyKey as string | undefined;
  const userId = (request as any)._idempotencyUserId as string | undefined;
  if (!compositeKey || !userId) return payload;

  try {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + IDEMPOTENCY.EXPIRES_HOURS);

    // Parse the serialized response body back to JSON for storage
    let responseBody: unknown = {};
    if (typeof payload === 'string') {
      try {
        responseBody = JSON.parse(payload);
      } catch {
        responseBody = { raw: payload };
      }
    } else if (payload && typeof payload === 'object') {
      responseBody = payload;
    }

    await prisma.idempotencyKey.create({
      data: {
        key: compositeKey,
        userId,
        responseStatus: reply.statusCode,
        responseBody: responseBody as any,
        expiresAt: expiry,
      },
    });
  } catch {
    request.log.warn({ key: compositeKey }, 'Failed to cache idempotency response');
  }

  return payload;
}
