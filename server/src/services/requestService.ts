/**
 * BErozgar — Request Service
 *
 * Exchange request lifecycle management.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError, ConflictError } from '@/errors/index';
import { PAGINATION } from '@/config/constants';
import type { CreateRequestInput, UpdateRequestEventInput } from '@/shared/validation';
import type { RequestStatus, Prisma } from '@prisma/client';
import { createRequestMachine } from '@/domain/fsm/RequestMachine';
import type { RequestEvent } from '@/domain/fsm/RequestMachine';

/* ═══════════════════════════════════════════════════
   Terminal statuses (for partial unique enforcement)
   ═══════════════════════════════════════════════════ */

const TERMINAL_STATUSES: RequestStatus[] = [
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
];

/* ═══════════════════════════════════════════════════
   Event → Status Mapping (FSM event → DB status)
   ═══════════════════════════════════════════════════ */

function applyRequestEvent(currentStatus: RequestStatus, event: string): RequestStatus {
  const stateMap: Record<RequestStatus, string> = {
    IDLE: 'idle',
    SENT: 'sent',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    MEETING_SCHEDULED: 'meeting_scheduled',
    COMPLETED: 'completed',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
    WITHDRAWN: 'withdrawn',
    DISPUTED: 'disputed',
    RESOLVED: 'resolved',
  };

  const reverseMap: Record<string, RequestStatus> = {};
  for (const [k, v] of Object.entries(stateMap)) {
    reverseMap[v] = k as RequestStatus;
  }

  const fsmState = stateMap[currentStatus];
  if (!fsmState) {
    throw new ConflictError(`Unknown request status: ${currentStatus}`);
  }

  const machine = createRequestMachine({
    state: fsmState as any,
    history: [],
  });

  if (!machine.can(event as RequestEvent)) {
    throw new ConflictError(
      `Cannot apply event '${event}' to request in state '${currentStatus}'`,
    );
  }

  const next = machine.send(event as RequestEvent);
  const newStatus = reverseMap[next.state];
  if (!newStatus) {
    throw new ConflictError(`FSM produced unknown state: ${next.state}`);
  }

  return newStatus;
}

/* ═══════════════════════════════════════════════════
   List Requests
   ═══════════════════════════════════════════════════ */

interface ListRequestsParams {
  userId: string;
  role: string;
  page?: number;
  limit?: number;
}

export async function listRequests(params: ListRequestsParams) {
  const page = params.page ?? PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(params.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const where: Prisma.RequestWhereInput =
    params.role === 'ADMIN'
      ? {}
      : {
        OR: [
          { buyerId: params.userId },
          { sellerId: params.userId },
        ],
      };

  const [requests, total] = await prisma.$transaction([
    prisma.request.findMany({
      where,
      include: {
        listing: { select: { id: true, title: true, ownerId: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
        seller: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.request.count({ where }),
  ]);

  return {
    requests,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/* ═══════════════════════════════════════════════════
   Get Single Request
   ═══════════════════════════════════════════════════ */

export async function getRequest(id: string, userId: string, role: string) {
  const req = await prisma.request.findUnique({
    where: { id },
    include: {
      listing: { include: { owner: { select: { id: true, fullName: true, email: true } } } },
      buyer: { select: { id: true, fullName: true, email: true } },
      seller: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!req) {
    throw new NotFoundError('Request', id);
  }

  // Non-admin users can only view their own requests
  if (role !== 'ADMIN' && req.buyerId !== userId && req.sellerId !== userId) {
    throw new ForbiddenError('You do not have access to this request');
  }

  return req;
}

/* ═══════════════════════════════════════════════════
   Create Request
   ═══════════════════════════════════════════════════ */

import { getCurrentUser } from '@/services/authService';

export async function createRequest(input: CreateRequestInput, buyerId: string) {
  // SEC-GOV-01: Enforce RestrictionEngine
  const trust = await getCurrentUser(buyerId);
  if (trust.restriction.isRestricted) {
    throw new ForbiddenError(`Action restricted: ${trust.restriction.reasons.join(' ')}`);
  }

  return prisma.$transaction(async (tx) => {
    // Verify listing exists and is approved
    // Acquisition-time check is okay for existence, but status must be locked atomically.
    const listing = await tx.listing.findUnique({
      where: { id: input.listingId },
    });

    if (!listing) {
      throw new NotFoundError('Listing', input.listingId);
    }

    if (listing.ownerId === buyerId) {
      throw new ConflictError('You cannot request your own listing');
    }

    // EXCH-RACE-01: Atomic Lock.
    // We update the status ONLY IF it is still APPROVED. 
    // This prevents two buyers from hitting the same listing at the exact same millisecond.
    const [updatedCount] = await Promise.all([
      tx.listing.updateMany({
        where: {
          id: input.listingId,
          status: 'APPROVED'
        },
        data: { status: 'INTEREST_RECEIVED' },
      }),
    ]);

    // If the listing wasn't APPROVED, it means someone else already requested it 
    // or it's in a different terminal state.
    if (updatedCount.count === 0 && listing.status === 'APPROVED') {
      throw new ConflictError('Listing was just taken by another user. Status outdated.');
    }

    // If it was already INTEREST_RECEIVED, that's okay (multiple interests allowed for some models, 
    // but here we check if a transaction is already in progress). 
    if (listing.status !== 'APPROVED' && listing.status !== 'INTEREST_RECEIVED') {
      throw new ConflictError('Listing is not available for requests');
    }

    // EXCH-RACE-02: Application-level check for buyer duality.
    // No active (non-terminal) request for same listing + buyer.
    const existing = await tx.request.findFirst({
      where: {
        listingId: input.listingId,
        buyerId,
        status: { notIn: TERMINAL_STATUSES },
      },
    });

    if (existing) {
      throw new ConflictError('You already have an active request for this listing');
    }

    const req = await tx.request.create({
      data: {
        listingId: input.listingId,
        buyerId,
        sellerId: listing.ownerId,
        status: 'SENT',
      },
      include: {
        listing: { select: { id: true, title: true, ownerId: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
        seller: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Audit log for request creation
    await tx.auditLog.create({
      data: {
        actorId: buyerId,
        action: 'REQUEST_CREATE',
        entityType: 'Request',
        entityId: req.id,
        metadata: { listingId: input.listingId, listingTitle: listing.title },
      },
    });

    return req;
  });
}

/* ═══════════════════════════════════════════════════
   Update Request Event (FSM Transition)
   ═══════════════════════════════════════════════════ */

/* ─── Role-to-event permission matrix ──────────────────────────────────────
   EXCH-BUG-05: without this, a buyer can ACCEPT (seller-only) and a seller
   can WITHDRAW (buyer-only). The FSM will reject the state change, BUT the
   audit log would still record a forbidden attempt under the wrong actor.
   Better to fail at the authorization gate, not inside the FSM.
────────────────────────────────────────────────────────────────────────── */
const BUYER_ONLY_EVENTS = new Set<string>(['SEND', 'WITHDRAW', 'DISPUTE']);
const SELLER_ONLY_EVENTS = new Set<string>(['ACCEPT', 'DECLINE']);
const EITHER_PARTY_EVENTS = new Set<string>(['SCHEDULE', 'CONFIRM', 'CANCEL']);
const ADMIN_ONLY_EVENTS = new Set<string>(['RESOLVE', 'EXPIRE']);

function authorizeEvent(
  event: string,
  actorId: string,
  actorRole: string,
  buyerId: string,
  sellerId: string,
): void {
  if (actorRole === 'ADMIN') return; // admins bypass role restrictions

  if (ADMIN_ONLY_EVENTS.has(event)) {
    throw new ForbiddenError(`Event '${event}' is restricted to administrators`);
  }

  const isBuyer = actorId === buyerId;
  const isSeller = actorId === sellerId;

  if (BUYER_ONLY_EVENTS.has(event) && !isBuyer) {
    throw new ForbiddenError(`Event '${event}' can only be performed by the buyer`);
  }
  if (SELLER_ONLY_EVENTS.has(event) && !isSeller) {
    throw new ForbiddenError(`Event '${event}' can only be performed by the seller`);
  }
  if (EITHER_PARTY_EVENTS.has(event) && !isBuyer && !isSeller) {
    throw new ForbiddenError('You are not a party to this request');
  }
}

export async function updateRequestEvent(
  requestId: string,
  input: UpdateRequestEventInput,
  actorId: string,
  actorRole: string,
) {
  return prisma.$transaction(async (tx) => {
    // PROD-06: removed service-level idempotency check. It used the raw
    // `idempotencyKey` while the middleware uses `${userId}:${key}` as the
    // composite key — they never matched, making this check dead code.
    // The middleware's onSend hook handles replay correctly at the HTTP layer.

    // 1. Acquire row-level lock with FOR UPDATE to prevent concurrent transitions
    const rows = await tx.$queryRaw<Array<{
      id: string;
      listing_id: string;
      buyer_id: string;
      seller_id: string;
      status: string;
      version: number;
    }>>`
      SELECT id, listing_id, buyer_id, seller_id, status, version
      FROM requests
      WHERE id = ${requestId}::uuid
      FOR UPDATE
    `;

    if (!rows || rows.length === 0) {
      throw new NotFoundError('Request', requestId);
    }

    const row = rows[0];

    // 2. Optimistic locking — if client sends version, verify it matches
    if (input.version !== undefined && input.version !== row.version) {
      throw new ConflictError(
        `Optimistic lock conflict: expected version ${input.version}, found ${row.version}. The request was modified by another user.`,
      );
    }

    // 3. Authorization: only buyer/seller can modify (or admin)
    if (actorRole !== 'ADMIN' && row.buyer_id !== actorId && row.seller_id !== actorId) {
      throw new ForbiddenError('You do not have access to this request');
    }

    // EXCH-BUG-05: role-level event authorization (before FSM, so audit log is clean)
    authorizeEvent(input.event, actorId, actorRole, row.buyer_id, row.seller_id);

    // 4. Apply FSM event → new status
    const newStatus = applyRequestEvent(row.status as RequestStatus, input.event);

    // 5. Update request status + bump version
    const updated = await tx.request.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        version: { increment: 1 },
      },
      include: {
        listing: { select: { id: true, title: true, ownerId: true } },
        buyer: { select: { id: true, fullName: true, email: true } },
        seller: { select: { id: true, fullName: true, email: true } },
      },
    });

    // 6. Side effects based on the transition
    if (newStatus === 'COMPLETED') {
      await tx.listing.update({
        where: { id: row.listing_id },
        data: { status: 'COMPLETED' },
      });

      // EXCH-BUG-02: increment BOTH parties' completedExchanges counters.
      await tx.user.updateMany({
        where: { id: { in: [row.seller_id, row.buyer_id] } },
        data: { completedExchanges: { increment: 1 } },
      });
    }

    if (newStatus === 'ACCEPTED') {
      // EXCH-BUG-06: When a request is accepted, the listing MUST move to IN_TRANSACTION.
      // This prevents other users from interacting with it until it's finished or cancelled.
      await tx.listing.update({
        where: { id: row.listing_id },
        data: { status: 'IN_TRANSACTION' },
      });
    }

    if (newStatus === 'CANCELLED' || newStatus === 'WITHDRAWN' || newStatus === 'DECLINED') {
      // EXCH-BUG-03: attribute CANCEL to the actor
      if (newStatus === 'CANCELLED') {
        await tx.user.update({
          where: { id: actorId },
          data: { cancelledRequests: { increment: 1 } },
        });
      }

      // EXCH-BUG-04 (Safe Version): Check if any OTHER active (non-terminal)
      // requests exist for this listing before reverting to APPROVED.
      const activeCount = await tx.request.count({
        where: {
          listingId: row.listing_id,
          id: { not: requestId },
          status: { notIn: TERMINAL_STATUSES },
        },
      });

      if (activeCount === 0) {
        await tx.listing.update({
          where: { id: row.listing_id },
          data: { status: 'APPROVED' },
        });
      }
    }

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'REQUEST_EVENT',
        entityType: 'Request',
        entityId: requestId,
        metadata: { event: input.event, from: row.status, to: newStatus, actorRole },
      },
    });

    // PROD-06 (part B): removed service-level idempotency store — the middleware's
    // onSend hook handles this with the correct composite key format.

    return updated;
  });
}
