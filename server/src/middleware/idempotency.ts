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
import { IdempotencyConflictError, IdempotencyReplayError } from '@/errors/index';

declare module 'fastify' {
  interface FastifyRequest {
    _idempotencyKey?: string;
    _idempotencyUserId?: string;
  }
}

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
        // CRIT-02 FIX: throw instead of reply.send()+return.  In Fastify v5
        // an async preHandler that calls reply.send() still lets the route
        // handler execute. Throwing routes to setErrorHandler, which reliably
        // bypasses the handler and its services.
        throw new IdempotencyConflictError('A request with this key is already being processed.');
      } else {
        // Replay: throw to abort route handler in Fastify v5.
        // reply.send() alone does not prevent the route handler from running
        // inside an async preHandler — the hook runner resolves the promise
        // unconditionally and then calls the route handler regardless of
        // reply.sent. Throwing causes Fastify to go to setErrorHandler
        // instead, which reliably bypasses the route handler and its services.
        throw new IdempotencyReplayError(existing.responseStatus, existing.responseBody);
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
    request._idempotencyKey = compositeKey;
    request._idempotencyUserId = userId;
  } catch (err: unknown) {
    // HIGH-01 FIX: only treat Prisma unique-constraint violations (P2002) as a
    // sentinel race. Any other DB error (deadlock, connection drop, timeout) must
    // bubble up so the global error handler can return a proper 5xx — not a fake 409
    // that would make the client believe the operation is already in-flight.
    if (err instanceof Error && 'code' in err && (err as Error & { code?: string }).code === 'P2002') {
      // CRIT-02 FIX: throw so Fastify v5 bypasses the route handler.
      request.log.warn({ key: compositeKey }, 'Idempotency sentinel race — unique constraint hit');
      throw new IdempotencyConflictError('Processing already in progress.');
    }
    throw err;
  }
}

/**
 * Background Task: Prune expired idempotency keys.
 * Should be called periodically (e.g., hourly) by a job runner or startup script.
 */
export async function pruneIdempotencyKeys(): Promise<number> {
  const now = new Date();

  // Remove normally-expired keys.
  const expired = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // MED-05 FIX: also remove stuck 102-Processing sentinels older than 10 minutes.
  // These are created when the preHandler claims a key but the server crashes
  // before idempotencyCacheResponse writes the real status. Without this cleanup
  // they block the client from retrying for the full EXPIRES_HOURS window.
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const stuckSentinels = await prisma.idempotencyKey.deleteMany({
    where: {
      responseStatus: 102,
      createdAt: { lt: tenMinutesAgo },
    },
  });

  return expired.count + stuckSentinels.count;
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
  const compositeKey = request._idempotencyKey;
  const userId = request._idempotencyUserId;
  if (!compositeKey || !userId) return payload;

  try {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + IDEMPOTENCY.EXPIRES_HOURS);

    // Parse payload safely
    let responseBody: Record<string, unknown> | Buffer = {};
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
    // CORR-1 FIX: if the upsert fails, delete the sentinel immediately so the
    // client isn't stuck receiving 409 for 10 minutes until the prune job runs.
    // On next retry, the operation will re-execute — this is acceptable because
    // the DB commit already happened (the user effectively got their resource).
    request.log.warn({ key: compositeKey, err }, 'Failed to cache idempotency response — deleting sentinel');
    try {
      await prisma.idempotencyKey.deleteMany({ where: { key: compositeKey } });
    } catch (deleteErr) {
      request.log.error({ key: compositeKey, deleteErr }, 'Failed to delete idempotency sentinel after cache failure');
    }
  }

  return payload;
}
