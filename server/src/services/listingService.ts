/**
 * BErozgar — Listing Service
 *
 * CRUD and FSM transitions for listings.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/errors/index';
import { InvalidTransitionError, ConflictError } from '@/errors/index';
import { PAGINATION } from '@/config/constants';
import type { CreateListingInput, UpdateListingStatusInput } from '@/shared/validation';
import type { ListingStatus, Prisma } from '@prisma/client';
import { createListingMachine } from '@/domain/fsm/ListingMachine';
import type { ListingState, ListingEvent } from '@/domain/fsm/ListingMachine';

/* ═══════════════════════════════════════════════════
   List Listings (with filtering)
   ═══════════════════════════════════════════════════ */

interface ListListingsParams {
  status?: string;
  category?: string;
  module?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function listListings(params: ListListingsParams) {
  const page = params.page ?? PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(params.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;

  const where: Prisma.ListingWhereInput = {};

  if (params.status) {
    where.status = params.status.toUpperCase() as ListingStatus;
  }
  if (params.category) {
    where.category = { equals: params.category, mode: 'insensitive' };
  }
  if (params.module) {
    where.module = { equals: params.module, mode: 'insensitive' };
  }
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [listings, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where,
      include: { owner: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/* ═══════════════════════════════════════════════════
   Get Single Listing
   ═══════════════════════════════════════════════════ */

export async function getListing(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, fullName: true, email: true } },
      requests: {
        select: { id: true, buyerId: true, status: true, createdAt: true },
      },
    },
  });

  if (!listing) {
    throw new NotFoundError('Listing', id);
  }

  return listing;
}

/* ═══════════════════════════════════════════════════
   Create Listing
   ═══════════════════════════════════════════════════ */

import { getCurrentUser } from '@/services/authService';

export async function createListing(
  input: CreateListingInput,
  userId: string,
) {
  // SEC-GOV-01: Enforce RestrictionEngine
  const trust = await getCurrentUser(userId);
  if (trust.restriction.isRestricted) {
    throw new ForbiddenError(`Action restricted: ${trust.restriction.reasons.join(' ')}`);
  }

  const listing = await prisma.listing.create({
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      module: input.module,
      price: input.price,
      status: 'DRAFT',
      ownerId: userId,
    },
    include: { owner: { select: { id: true, fullName: true, email: true } } },
  });

  return listing;
}

/* ═══════════════════════════════════════════════════
   Update Listing Status (FSM transition)
   ═══════════════════════════════════════════════════ */

/* ─── FSM state ↔ DB status mapping ────────────────────────────────────────
   EXCH-BUG-06: the old flat STATUS_MAP allowed any status to be stamped at
   any time. Now every admin-level status change is validated through the
   ListingMachine FSM before being committed.
──────────────────────────────────────────────────────────────────────────── */

const DB_TO_FSM: Record<ListingStatus, ListingState> = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  INTEREST_RECEIVED: 'interest_received',
  IN_TRANSACTION: 'in_transaction',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  FLAGGED: 'flagged',
  ARCHIVED: 'archived',
  REMOVED: 'removed',
};

const FSM_TO_DB: Record<ListingState, ListingStatus> = {
  draft: 'DRAFT',
  pending_review: 'PENDING_REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  interest_received: 'INTEREST_RECEIVED',
  in_transaction: 'IN_TRANSACTION',
  completed: 'COMPLETED',
  expired: 'EXPIRED',
  flagged: 'FLAGGED',
  archived: 'ARCHIVED',
  removed: 'REMOVED',
};

const STATUS_TO_EVENT: Record<string, ListingEvent> = {
  pending_review: 'SUBMIT',
  approved: 'APPROVE',
  rejected: 'REJECT',
};

export async function updateListingStatus(
  listingId: string,
  input: UpdateListingStatusInput,
  actorId: string,
  actorRole: string,
) {
  return prisma.$transaction(async (tx) => {
    // PROD-09: acquire row-level lock to serialise concurrent status transitions.
    // Without this, two concurrent PATCH requests can both succeed, with the
    // last writer silently overwriting the first.
    const rows = await tx.$queryRaw<Array<{
      id: string;
      status: string;
      owner_id: string;
    }>>`
      SELECT id, status, owner_id
      FROM listings
      WHERE id = ${listingId}::uuid
      FOR UPDATE
    `;

    if (!rows || rows.length === 0) {
      throw new NotFoundError('Listing', listingId);
    }

    const listing = rows[0];

    // SEC-AUTH-03: Ownership bypass check
    // Only owner OR admin can update status.
    if (listing.owner_id !== actorId && actorRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to modify this listing');
    }

    // Only admins can approve/reject
    if (
      (input.status === 'approved' || input.status === 'rejected') &&
      actorRole !== 'ADMIN'
    ) {
      throw new ForbiddenError('Only admins can approve or reject listings');
    }

    const event = STATUS_TO_EVENT[input.status];
    if (!event) {
      throw new InvalidTransitionError('Listing', listing.status, input.status);
    }

    // EXCH-BUG-06: validate the transition through the FSM
    const fsmState = DB_TO_FSM[listing.status as ListingStatus];
    if (!fsmState) {
      throw new ConflictError(`Unknown listing status: ${listing.status}`);
    }
    const machine = createListingMachine({ state: fsmState, history: [] });
    if (!machine.can(event)) {
      throw new ConflictError(
        `Cannot apply '${event}' to listing in state '${listing.status}'. Invalid FSM transition.`,
      );
    }
    const nextFsm = machine.send(event);
    const newStatus = FSM_TO_DB[nextFsm.state];

    const updated = await tx.listing.update({
      where: { id: listingId },
      data: { status: newStatus },
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    });

    // Create audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'LISTING_STATUS_UPDATE',
        entityType: 'Listing',
        entityId: listingId,
        metadata: { from: listing.status, to: newStatus, via: event },
      },
    });

    return updated;
  });
}
