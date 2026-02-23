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

export async function createRequest(input: CreateRequestInput, buyerId: string) {
  return prisma.$transaction(async (tx) => {
    // Verify listing exists and is approved
    const listing = await tx.listing.findUnique({
      where: { id: input.listingId },
    });

    if (!listing) {
      throw new NotFoundError('Listing', input.listingId);
    }

    if (listing.status !== 'APPROVED' && listing.status !== 'INTEREST_RECEIVED') {
      throw new ConflictError('Listing is not available for requests');
    }

    if (listing.ownerId === buyerId) {
      throw new ConflictError('You cannot request your own listing');
    }

    // Application-level partial unique check (race-safe inside tx):
    // No active (non-terminal) request for same listing + buyer
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

    // Update listing status to INTEREST_RECEIVED if first request
    if (listing.status === 'APPROVED') {
      await tx.listing.update({
        where: { id: input.listingId },
        data: { status: 'INTEREST_RECEIVED' },
      });
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

export async function updateRequestEvent(
  requestId: string,
  input: UpdateRequestEventInput,
  actorId: string,
  actorRole: string,
) {
  return prisma.$transaction(async (tx) => {
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

      await tx.user.update({
        where: { id: row.seller_id },
        data: { completedExchanges: { increment: 1 } },
      });
    }

    if (newStatus === 'CANCELLED') {
      await tx.user.update({
        where: { id: row.buyer_id },
        data: { cancelledRequests: { increment: 1 } },
      });
    }

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'REQUEST_EVENT',
        entityType: 'Request',
        entityId: requestId,
        metadata: { event: input.event, from: row.status, to: newStatus },
      },
    });

    return updated;
  });
}
