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
import type { RequestStatus, Prisma } from '@prisma/client';
import { ListingStatus, ListingModule } from '@prisma/client';
import { createListingMachine } from '@/domain/fsm/ListingMachine';
import type { ListingState, ListingEvent } from '@/domain/fsm/ListingMachine';
import { evaluateFraudHeuristics, isFraudReviewRequired } from '@/domain/fraudHeuristics';
import { requireWritePrivilege } from '@/services/adminService';

/* ═══════════════════════════════════════════════════
   List Listings (with filtering)
   ═══════════════════════════════════════════════════ */

interface ListListingsParams {
  status?: string;
  category?: string;
  module?: string;
  limit?: number;
  page?: number;
  cursor?: string; // GAP-08: cursor for pagination
  search?: string;
}

export async function listListings(params: ListListingsParams) {
  const limit = Math.min(params.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
  const cursor = params.cursor;

  const where: Prisma.ListingWhereInput = {};

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (Object.values(ListingStatus).includes(statusVal as ListingStatus)) {
      where.status = statusVal as ListingStatus;
    }
  }
  if (params.category) {
    where.category = { equals: params.category };
  }
  if (params.module) {
    const moduleVal = params.module.toUpperCase();
    if (Object.values(ListingModule).includes(moduleVal as ListingModule)) {
      where.module = { equals: moduleVal as ListingModule };
    }
  }
  if (params.search) {
    where.OR = [
      { title: { contains: params.search } },
      { description: { contains: params.search } },
    ];
  }

  // IAM: Exclude PUBLIC_USER sellers from resale search results
  where.owner = { role: { not: 'PUBLIC_USER' } };

  // GAP-08 FIX: Migrate to cursor-based pagination to avoid full table scans (O(N) skip).
  // Cursor-based is O(1) jump using the index on ID. 
  // We fetch limit + 1 to see if a next page exists.
  const listings = await prisma.listing.findMany({
    where,
    include: { owner: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  const hasNextPage = listings.length > limit;
  const items = hasNextPage ? listings.slice(0, limit) : listings;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  // Convert Prisma Decimal → string
  const formattedItems = items.map((l) => ({ ...l, price: l.price.toString() }));

  return {
    listings: formattedItems,
    pagination: {
      limit,
      nextCursor,
      hasNextPage,
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
      // CRIT-F FIX: email omitted — GET /listings/:id is unauthenticated.
      owner: { select: { id: true, fullName: true } },
      requests: {
        select: { id: true, buyerId: true, status: true, createdAt: true },
      },
    },
  });

  if (!listing) {
    throw new NotFoundError('Listing', id);
  }

  // Convert Prisma Decimal → string
  return { ...listing, price: listing.price.toString() };
}

/* ═══════════════════════════════════════════════════
   Create Listing
   ═══════════════════════════════════════════════════ */

import { getCurrentUser } from '@/services/authService';

export async function createListing(
  input: CreateListingInput,
  userId: string,
) {
  // SEC-GOV-01: Pre-flight restriction check (fast-path)
  const trust = await getCurrentUser(userId);
  if (trust.restriction.isRestricted) {
    throw new ForbiddenError(`Action restricted: ${trust.restriction.reasons.join(' ')}`);
  }

  // V3-08: Re-check isRestricted inside a transaction to close the TOCTOU window
  // where an admin restricts the user between the pre-flight check and the DB write.
  const listing = await prisma.$transaction(async (tx) => {
    const userRow = await tx.user.findUnique({
      where: { id: userId },
      select: { isRestricted: true },
    });
    if (userRow?.isRestricted) {
      throw new ForbiddenError('Your account has been restricted from creating listings');
    }

    return tx.listing.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        module: input.module as ListingModule,
        price: input.price,
        status: 'PENDING_REVIEW',
        ownerId: userId,
      },
      // CRIT-1 FIX: email stripped — owner email must never travel in API responses
      include: { owner: { select: { id: true, fullName: true } } },
    });
  });

  // CRIT-1 FIX: Run server-side fraud heuristics with real user data AFTER the
  // listing is committed. Client-side fraudService.evaluateAndFlag() previously
  // called POST /admin/audit which requires ADMIN role → always silently 403'd.
  // This check is best-effort: failure must never block the listing creation response.
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);
    const [recentListingCount, userStats] = await Promise.all([
      prisma.listing.count({
        where: { ownerId: userId, createdAt: { gte: oneDayAgo } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { cancelledRequests: true, adminFlags: true, createdAt: true, _count: { select: { disputes: true } } },
      }),
    ]);

    if (userStats) {
      const accountAgeDays = Math.floor(
        (Date.now() - userStats.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const fraudResult = evaluateFraudHeuristics({
        recentListings: recentListingCount,
        recentCancellations: userStats.cancelledRequests,
        recentDisputes: userStats._count.disputes,
        accountAgeDays,
      });

      if (isFraudReviewRequired(fraudResult)) {
        // Atomically increment adminFlags + write audit entry so the
        // admin fraud dashboard picks this up immediately.
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { adminFlags: { increment: 1 } },
          }),
          prisma.auditLog.create({
            data: {
              actorId: null, // SYSTEM
              action: 'ADMIN_FLAG_USER',
              entityType: 'User',
              entityId: userId,
              metadata: {
                trigger: 'LISTING_CREATED',
                listingId: listing.id,
                riskLevel: fraudResult.riskLevel,
                flags: fraudResult.flags,
              },
            },
          }),
        ]);
      }
    }
  } catch {
    // Non-fatal — fraud check must never block listing creation
  }

  // Convert Prisma Decimal → string
  return { ...listing, price: listing.price.toString() };
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
  // NEW-BUG-03 FIX: admin/system-only transitions previously unreachable via API
  flagged: 'FLAG',
  removed: 'REMOVE',
  archived: 'ARCHIVE',
  expired: 'EXPIRE',
};

export async function updateListingStatus(
  listingId: string,
  input: UpdateListingStatusInput,
  actorId: string,
  actorRole: string,
) {
  return prisma.$transaction(async (tx) => {
    // PROD-09: acquire row-level lock (emulated via findUnique for SQLite)
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: { id: true, status: true, ownerId: true },
    });

    if (!listing) {
      throw new NotFoundError('Listing', listingId);
    }

    // SEC-AUTH-03: Ownership bypass check
    // Only owner OR admin can update status.
    if (listing.ownerId !== actorId && actorRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to modify this listing');
    }

    // Only admins can approve/reject/flag/remove/expire
    // NEW-BUG-03 FIX: extended admin-only guard to cover all privileged transitions
    const adminOnlyStatuses = ['approved', 'rejected', 'flagged', 'removed', 'expired'];
    if (adminOnlyStatuses.includes(input.status) && actorRole !== 'ADMIN') {
      throw new ForbiddenError('Only admins can perform this status transition');
    }

    // OBSERVER admins are read-only — block write operations
    if (adminOnlyStatuses.includes(input.status) && actorRole === 'ADMIN') {
      await requireWritePrivilege(actorId);
    }

    const event = STATUS_TO_EVENT[input.status];
    if (!event) {
      throw new InvalidTransitionError('Listing', listing.status, input.status);
    }

    // EXCH-BUG-06: validate the transition through the FSM
    const fsmState = DB_TO_FSM[listing.status as ListingStatus];
    if (!fsmState) {
      console.error('[SEC-4] Unknown listing status in FSM lookup:', listing.status);
      throw new ConflictError('This listing is in an unexpected state and cannot be updated right now.');
    }
    const machine = createListingMachine({ state: fsmState, history: [] });
    if (!machine.can(event)) {
      console.warn('[SEC-4] Rejected listing FSM transition:', event, listing.status);
      throw new ConflictError(
        'This action cannot be performed on the listing in its current state.',
      );
    }
    const nextFsm = machine.send(event);
    const newStatus = FSM_TO_DB[nextFsm.state];

    // Atomic check: prevent concurrent modifications to the same listing
    const updatedCount = await tx.listing.updateMany({
      where: { id: listingId, status: listing.status },
      data: { status: newStatus },
    });

    if (updatedCount.count === 0) {
      throw new ConflictError('Listing status was modified concurrently. Please refresh and try again.');
    }

    const updated = await tx.listing.findUniqueOrThrow({
      where: { id: listingId },
      // HIGH-2 FIX: email stripped — owner email must never travel in API responses
      include: { owner: { select: { id: true, fullName: true } } },
    });

    // V3-04: When a listing is flagged or removed by an admin, atomically cancel
    // all non-terminal requests for it. Without this, buyer and seller are stuck:
    // CONFIRM fails (listing no longer IN_TRANSACTION), CANCEL fails (listing not
    // IN_TRANSACTION/INTEREST_RECEIVED), and they must wait 14 days for expiry.
    if (event === 'FLAG' || event === 'REMOVE') {
      const activeStatuses = ['SENT', 'ACCEPTED', 'MEETING_SCHEDULED', 'DISPUTED'];
      await tx.request.updateMany({
        where: {
          listingId,
          status: { in: activeStatuses as RequestStatus[] },
        },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: 'REQUESTS_FORCE_CANCELLED',
          entityType: 'Listing',
          entityId: listingId,
          metadata: {
            reason: `Listing transitioned to ${newStatus} by admin`,
            affectedStatuses: activeStatuses,
          },
        },
      });
    }

    // V3-07: Populate the actorRole column (not just metadata) so audit queries
    // using the indexed actorRole column work correctly.
    await tx.auditLog.create({
      data: {
        actorId,
        actorRole,
        action: 'LISTING_STATUS_UPDATE',
        entityType: 'Listing',
        entityId: listingId,
        metadata: { from: listing.status, to: newStatus, via: event },
      },
    });

    return updated;
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });
}

/* ═══════════════════════════════════════════════════
   Update Listing (Edit)
   ═══════════════════════════════════════════════════ */

export async function updateListing(
  listingId: string,
  input: CreateListingInput, // reuse CreateListingInput for edits
  userId: string,
  userRole: string,
) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true, status: true },
  });

  if (!listing) {
    throw new NotFoundError('Listing', listingId);
  }

  // Only owner or admin can edit
  if (listing.ownerId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not have permission to edit this listing');
  }

  // To keep FSM clean, editing an APPROVED listing forces re-review to prevent
  // policy bypass (e.g., user gets approved then edits title to include spam).
  // Only PENDING_REVIEW, REJECTED, and DRAFT listings can be freely edited.
  const needsReReview = listing.status === 'APPROVED';

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      module: input.module as ListingModule,
      price: input.price,
      ...(needsReReview ? { status: 'PENDING_REVIEW' } : {}),
    },
    include: { owner: { select: { id: true, fullName: true } } },
  });

  return { ...updated, price: updated.price.toString() };
}

/* ═══════════════════════════════════════════════════
   Delete Listing
   ═══════════════════════════════════════════════════ */

export async function deleteListing(listingId: string, userId: string, userRole: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true },
  });

  if (!listing) {
    throw new NotFoundError('Listing', listingId);
  }

  if (listing.ownerId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not have permission to delete this listing');
  }

  await prisma.$transaction(async (tx) => {
    // Cancel related requests — bump version so optimistic-lock clients detect it
    await tx.request.updateMany({
      where: { listingId },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });

    await tx.listing.delete({
      where: { id: listingId },
    });

    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorRole: userRole,
        action: 'LISTING_DELETED',
        entityType: 'Listing',
        entityId: listingId,
      },
    });
  });

  return { success: true };
}
