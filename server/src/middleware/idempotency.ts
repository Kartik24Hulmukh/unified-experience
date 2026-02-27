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

  // SEC-IDEM-02: validate key length before using it as a storage key
  if (key.length > 128) {
    reply.status(400).send({
      error: 'Idempotency key too long',
      code: 'IDEMPOTENCY_KEY_INVALID',
      message: 'X-Idempotency-Key must be 128 characters or fewer',
    });
    return;
  }

  const compositeKey = `${userId}:${key}`;

  // SEC-IDEM-03: Race condition prevention.
  // Instead of findUnique -> logic -> onSend:upsert, we perform an atomic
  // 'claim' on the key here. If it already exists, we replay or conflict.
  // If it doesn't, we create a 'SENTINEL' record (102 Processing) to lock it.
  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: compositeKey },
    });

    if (existing) {
      if (existing.expiresAt < new Date()) {
        // Expired — delete and proceed to re-claim
        await prisma.idempotencyKey.delete({ where: { id: existing.id } });
      } else if (existing.responseStatus === 102) {
        // Locked/Processing — tell client to back off
        reply.status(409).send({
          error: 'Conflict',
          code: 'IDEMPOTENCY_PROCESSING',
          message: 'A request with this key is already being processed.',
        });
        return;
      } else {
        // Replay cached response
        reply
          .status(existing.responseStatus)
          .headers({ 'x-idempotency-replay': 'true' })
          .send(existing.responseBody);
        return;
      }
    }

    // Create sentinel to lock the key for the duration of this request
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + IDEMPOTENCY.EXPIRES_HOURS);

    await prisma.idempotencyKey.create({
      data: {
        key: compositeKey,
        userId,
        responseStatus: 102, // Processing sentinel
        responseBody: {},
        expiresAt: expiry,
      },
    });

    // Mark for onSend to update the sentinel
    (request as any)._idempotencyKey = compositeKey;
    (request as any)._idempotencyUserId = userId;
  } catch (err) {
    // If a collision happens between findUnique and create (rare but possible),
    // the unique constraint will catch it.
    request.log.warn({ key: compositeKey, err }, 'Idempotency lock collision');
    reply.status(409).send({
      error: 'Conflict',
      code: 'IDEMPOTENCY_RACE',
      message: 'Processing already in progress.',
    });
  }
}

/**
 * Background Task: Prune expired idempotency keys.
 * Should be called periodically (e.g., hourly) by a job runner or startup script.
 */
export async function pruneIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * onSend — if the request was marked by the preHandler, store the
 * serialized response body so future replays return the real payload.
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

    // Parse payload safely
    let responseBody: any = {};
    if (typeof payload === 'string') {
      try {
        responseBody = JSON.parse(payload);
      } catch {
        responseBody = { raw: payload };
      }
    } else if (payload && typeof payload === 'object') {
      responseBody = payload;
    }

    // UPDATE: Only store if the request was successful or a 4xx.
    // We generally don't want to cache 5xx internal errors.
    if (reply.statusCode >= 500) {
      await prisma.idempotencyKey.deleteMany({ where: { key: compositeKey } });
      return payload;
    }

    await prisma.idempotencyKey.upsert({
      where: { key: compositeKey },
      update: {
        responseStatus: reply.statusCode,
        responseBody: responseBody,
        expiresAt: expiry,
      },
      create: {
        key: compositeKey,
        userId,
        responseStatus: reply.statusCode,
        responseBody: responseBody,
        expiresAt: expiry,
      },
    });
  } catch (err) {
    request.log.warn({ key: compositeKey, err }, 'Failed to cache idempotency response');
  }

  return payload;
}
