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

// NEW-BUG-02 FIX: 'RESOLVED' was missing, causing buyers with resolved requests
// to be permanently blocked from re-requesting the same listing (EXCH-RACE-02),
// and preventing cancelled-request listing reset (EXCH-BUG-04 activeCount check).
// 'DISPUTED' is intentionally excluded — active litigation is not terminal.
const TERMINAL_STATUSES: RequestStatus[] = [
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  'RESOLVED',
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
    throw new ConflictError('This request is in an unexpected state and cannot be updated right now.');
  }

  const machine = createRequestMachine({
    state: fsmState as any,
    history: [],
  });

  if (!machine.can(event as RequestEvent)) {
    throw new ConflictError(
      'This action cannot be performed on the request in its current state.',
    );
  }

  const next = machine.send(event as RequestEvent);
  const newStatus = reverseMap[next.state];
  if (!newStatus) {
    throw new ConflictError('An unexpected error occurred while processing this request. Please try again.');
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
        // HIGH-3 FIX: email stripped — buyer/seller emails must not be exposed pre-acceptance
        buyer: { select: { id: true, fullName: true } },
        seller: { select: { id: true, fullName: true } },
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
      // HIGH-3 FIX: email stripped — never expose buyer/seller/owner email in request responses
      listing: { include: { owner: { select: { id: true, fullName: true } } } },
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
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
  // SEC-GOV-01: Pre-flight restriction check (fast-path)
  const trust = await getCurrentUser(buyerId);
  if (trust.restriction.isRestricted) {
    throw new ForbiddenError(`Action restricted: ${trust.restriction.reasons.join(' ')}`);
  }

  return prisma.$transaction(async (tx) => {
    // V3-08: Re-check isRestricted inside the transaction to close the TOCTOU window
    // where an admin restricts the user between the pre-flight check and this write.
    const userRow = await tx.user.findUnique({
      where: { id: buyerId },
      select: { isRestricted: true },
    });
    if (userRow?.isRestricted) {
      throw new ForbiddenError('Your account has been restricted from creating requests');
    }
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

    // CRIT-03 FIX: If the CAS missed (count === 0), the listing is no longer
    // APPROVED — always throw. The previous code re-read the listing and only
    // threw when status was NOT INTEREST_RECEIVED, meaning a second buyer whose
    // listing was already INTEREST_RECEIVED would silently fall through and
    // create a second active request on the same listing.
    if (updatedCount.count === 0) {
      throw new ConflictError(
        'Listing is no longer available for requests. Another buyer may have already shown interest.',
      );
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
        // HIGH-3 FIX: email stripped — buyer/seller emails must not be exposed pre-acceptance
        buyer: { select: { id: true, fullName: true } },
        seller: { select: { id: true, fullName: true } },
      },
    });

    // Audit log for request creation
    await tx.auditLog.create({
      data: {
        actorId: buyerId,
        actorRole: 'STUDENT_VERIFIED',
        action: 'REQUEST_CREATE',
        entityType: 'Request',
        entityId: req.id,
        metadata: { listingId: input.listingId, listingTitle: listing.title },
      },
    });

    return req;
  }, {
    maxWait: 10_000,
    timeout: 20_000,
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
      WHERE id = ${requestId}
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
        // HIGH-3 FIX: email stripped — buyer/seller emails must not be exposed pre-acceptance
        buyer: { select: { id: true, fullName: true } },
        seller: { select: { id: true, fullName: true } },
      },
    });

    // 6. Side effects based on the transition
    if (newStatus === 'COMPLETED') {
      // NEW-BUG-01 FIX: Use updateMany with WHERE assertion so a listing in an
      // unexpected state (e.g., flagged) does not silently get overwritten.
      const completedCount = await tx.listing.updateMany({
        where: { id: row.listing_id, status: 'IN_TRANSACTION' },
        data: { status: 'COMPLETED' },
      });
      if (completedCount.count === 0) {
        // Listing was not in the expected IN_TRANSACTION state — log and surface, do not silently corrupt.
        throw new ConflictError(
          'Cannot complete this exchange — the listing was modified by another action. Please refresh and try again.',
        );
      }

      // EXCH-BUG-02: increment BOTH parties' completedExchanges counters.
      await tx.user.updateMany({
        where: { id: { in: [row.seller_id, row.buyer_id] } },
        data: { completedExchanges: { increment: 1 } },
      });
    }

    if (newStatus === 'ACCEPTED') {
      // EXCH-BUG-06: When a request is accepted, the listing MUST move to IN_TRANSACTION.
      // This prevents other users from interacting with it until it's finished or cancelled.
      // NEW-BUG-01 FIX: Assert expected prior state in WHERE clause.
      const acceptedCount = await tx.listing.updateMany({
        where: { id: row.listing_id, status: { in: ['INTEREST_RECEIVED', 'APPROVED'] } },
        data: { status: 'IN_TRANSACTION' },
      });
      if (acceptedCount.count === 0) {
        throw new ConflictError(
          'Listing is not in an available state to accept; possible concurrent state change.',
        );
      }
    }

    if (newStatus === 'CANCELLED' || newStatus === 'WITHDRAWN' || newStatus === 'DECLINED') {
      // EXCH-BUG-03: attribute CANCEL to the actor
      // NEW-RACE-03 FIX: WITHDRAWN (buyer retracts a sent request) also counts against
      // the actor — prevents repeated send/withdraw harassment with zero trust penalty.
      if (newStatus === 'CANCELLED' || newStatus === 'WITHDRAWN') {
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
        // NEW-BUG-01 FIX: Use updateMany with WHERE to guard against unexpected listing state.
        // If another concurrent transaction already changed the listing (e.g., admin flagged it),
        // the update is a no-op rather than silently overwriting an unintended state.
        await tx.listing.updateMany({
          where: { id: row.listing_id, status: { in: ['IN_TRANSACTION', 'INTEREST_RECEIVED'] } },
          data: { status: 'APPROVED' },
        });
      }
    }

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        actorId,
        actorRole,
        action: 'REQUEST_EVENT',
        entityType: 'Request',
        entityId: requestId,
        metadata: { event: input.event, from: row.status, to: newStatus, actorRole },
      },
    });

    // PROD-06 (part B): removed service-level idempotency store — the middleware's
    // onSend hook handles this with the correct composite key format.

    return updated;
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });
}
