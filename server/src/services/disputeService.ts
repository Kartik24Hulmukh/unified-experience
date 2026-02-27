/**
 * BErozgar — Dispute Service
 *
 * Dispute lifecycle management with FSM transitions.
 * Supports disputes via request or listing with required type/description/againstId.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '@/errors/index';
import { PAGINATION } from '@/config/constants';
import type { CreateDisputeInput, UpdateDisputeStatusInput } from '@/shared/validation';
import type { DisputeStatus, DisputeType } from '@prisma/client';
import { createDisputeMachine } from '@/domain/disputeEngine';
import type { DisputeEvent, DisputeState } from '@/domain/disputeEngine';

/* ═══════════════════════════════════════════════════
   FSM Transition Helper
   ═══════════════════════════════════════════════════ */

const STATUS_TO_FSM: Record<DisputeStatus, DisputeState> = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  ESCALATED: 'ESCALATED',
};

const FSM_TO_DB: Record<DisputeState, DisputeStatus> = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  ESCALATED: 'ESCALATED',
};

const STATUS_TO_EVENT: Record<string, DisputeEvent> = {
  UNDER_REVIEW: 'BEGIN_REVIEW',
  RESOLVED: 'RESOLVE',
  REJECTED: 'REJECT',
  ESCALATED: 'ESCALATE',
};

function applyDisputeTransition(
  currentStatus: DisputeStatus,
  targetStatus: string,
): DisputeStatus {
  const fsmState = STATUS_TO_FSM[currentStatus];
  const event = STATUS_TO_EVENT[targetStatus];

  if (!event) {
    throw new ConflictError(`Invalid target status: ${targetStatus}`);
  }

  const machine = createDisputeMachine({ state: fsmState });

  if (!machine.can(event)) {
    throw new ConflictError(
      `Cannot transition dispute from '${currentStatus}' to '${targetStatus}'`,
    );
  }

  const next = machine.send(event);
  return FSM_TO_DB[next.state];
}

/* ═══════════════════════════════════════════════════
   List Disputes
   ═══════════════════════════════════════════════════ */

interface ListDisputesParams {
  userId: string;
  role: string;
  page?: number;
  limit?: number;
}

export async function listDisputes(params: ListDisputesParams) {
  const page = params.page ?? PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(
    params.limit ?? PAGINATION.DEFAULT_LIMIT,
    PAGINATION.MAX_LIMIT,
  );
  const skip = (page - 1) * limit;

  const where =
    params.role === 'ADMIN'
      ? {}
      : {
        OR: [
          { raisedById: params.userId },
          { againstId: params.userId },
        ],
      };

  const [disputes, total] = await prisma.$transaction([
    prisma.dispute.findMany({
      where,
      include: {
        raisedBy: { select: { id: true, fullName: true, email: true } },
        against: { select: { id: true, fullName: true, email: true } },
        request: {
          select: {
            id: true,
            listing: { select: { id: true, title: true } },
          },
        },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    disputes,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/* ═══════════════════════════════════════════════════
   Create Dispute
   ═══════════════════════════════════════════════════ */

export async function createDispute(input: CreateDisputeInput, raisedById: string) {
  return prisma.$transaction(async (tx) => {
    // Verify the against user exists
    const againstUser = await tx.user.findUnique({
      where: { id: input.againstId },
    });
    if (!againstUser) {
      throw new NotFoundError('User', input.againstId);
    }

    // Cannot dispute yourself
    if (raisedById === input.againstId) {
      throw new ConflictError('You cannot raise a dispute against yourself');
    }

    let requestId: string | null = input.requestId ?? null;
    let listingId: string | null = input.listingId ?? null;

    // If requestId, verify request and that raiser is a party
    if (requestId) {
      const request = await tx.request.findUnique({
        where: { id: requestId },
        include: { listing: true },
      });

      if (!request) {
        throw new NotFoundError('Request', requestId);
      }

      // Raiser must be buyer or seller
      if (request.buyerId !== raisedById && request.sellerId !== raisedById) {
        throw new ForbiddenError('You are not a party to this request');
      }

      // Set listingId from request if not provided
      if (!listingId) {
        listingId = request.listingId;
      }

      // EXCH-BUG-08: apply DISPUTED transition via FSM + version bump, not a raw status write.
      // Direct write bypasses the version counter, silently breaking optimistic locking.
      if (request.status !== 'DISPUTED') {
        const validFromStates: string[] = ['COMPLETED', 'ACCEPTED', 'MEETING_SCHEDULED'];
        if (!validFromStates.includes(request.status)) {
          throw new ConflictError(
            `Cannot file a dispute for a request in state '${request.status}'. Only COMPLETED or active meeting requests can be disputed.`,
          );
        }
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: 'DISPUTED',
            version: { increment: 1 },
          },
        });
      }
    }

    // If listingId but no requestId, verify listing exists
    if (listingId && !requestId) {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
      });
      if (!listing) {
        throw new NotFoundError('Listing', listingId);
      }
    }

    // Prevent duplicate active disputes
    const existing = await tx.dispute.findFirst({
      where: {
        raisedById,
        againstId: input.againstId,
        ...(requestId ? { requestId } : {}),
        ...(listingId && !requestId ? { listingId } : {}),
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
    });

    if (existing) {
      throw new ConflictError('You already have an active dispute for this');
    }

    const dispute = await tx.dispute.create({
      data: {
        requestId,
        listingId,
        raisedById,
        againstId: input.againstId,
        type: input.type as DisputeType,
        description: input.description,
        status: 'OPEN',
      },
      include: {
        raisedBy: { select: { id: true, fullName: true, email: true } },
        against: { select: { id: true, fullName: true, email: true } },
        request: { select: { id: true, listing: { select: { id: true, title: true } } } },
        listing: { select: { id: true, title: true } },
      },
    });

    // Audit
    await tx.auditLog.create({
      data: {
        actorId: raisedById,
        action: 'DISPUTE_CREATE',
        entityType: 'Dispute',
        entityId: dispute.id,
        metadata: {
          type: input.type,
          againstId: input.againstId,
          requestId,
          listingId,
        },
      },
    });

    return dispute;
  });
}

/* ═══════════════════════════════════════════════════
   Update Dispute Status (Admin Only)
   ═══════════════════════════════════════════════════ */

export async function updateDisputeStatus(
  disputeId: string,
  input: UpdateDisputeStatusInput,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    // PROD-05: acquire row-level lock to prevent two concurrent admin
    // PATCH requests from both reading the same status and both
    // succeeding (the second write would silently overwrite the first).
    const rows = await tx.$queryRaw<Array<{
      id: string;
      status: string;
      request_id: string | null;
      against_id: string;
    }>>`
      SELECT id, status, request_id, against_id
      FROM disputes
      WHERE id = ${disputeId}::uuid
      FOR UPDATE
    `;

    if (!rows || rows.length === 0) {
      throw new NotFoundError('Dispute', disputeId);
    }

    const dispute = rows[0];

    const newStatus = applyDisputeTransition(dispute.status as DisputeStatus, input.status);

    const updated = await tx.dispute.update({
      where: { id: disputeId },
      data: { status: newStatus },
      include: {
        raisedBy: { select: { id: true, fullName: true, email: true } },
        against: { select: { id: true, fullName: true, email: true } },
        request: { select: { id: true, listing: { select: { id: true, title: true } } } },
        listing: { select: { id: true, title: true } },
      },
    });

    // If dispute is resolved and has a request, transition request to RESOLVED
    if (newStatus === 'RESOLVED' && dispute.request_id) {
      await tx.request.update({
        where: { id: dispute.request_id },
        data: { status: 'RESOLVED', version: { increment: 1 } },
      });

      // PROD-03: the original code did `adminFlags: { increment: 0 }` which is a no-op.
      // The intent was to record that this user lost a dispute, so the trust engine
      // penalises them on next computation. Without this, serial offenders keep
      // GOOD_STANDING forever.
      await tx.user.update({
        where: { id: dispute.against_id },
        data: { adminFlags: { increment: 1 } },
      });
    }

    if (newStatus === 'REJECTED' && dispute.request_id) {
      // Dispute was invalid — buyer filed falsely; move request back to COMPLETED
      await tx.request.update({
        where: { id: dispute.request_id },
        data: { status: 'COMPLETED', version: { increment: 1 } },
      });
    }

    // Audit
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'DISPUTE_STATUS_UPDATE',
        entityType: 'Dispute',
        entityId: disputeId,
        // EXCH-BUG-09 (audit): record actorRole so audit trail shows who resolved
        metadata: { from: dispute.status, to: newStatus, actorRole: 'ADMIN' },
      },
    });

    return updated;
  });
}
