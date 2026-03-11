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
import type { ListingStatus, RequestStatus, Prisma } from '@prisma/client';
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

  // IAM: Exclude PUBLIC_USER sellers from resale search results
  where.owner = { ...((where.owner as Record<string, unknown>) ?? {}), role: { not: 'PUBLIC_USER' } };

  const [rawListings, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where,
      // CRIT-F FIX: email omitted — GET /listings is unauthenticated; exposing
      // owner email to anonymous callers is a PII/enumeration risk.
      include: { owner: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.listing.count({ where }),
  ]);

  // Convert Prisma Decimal → string so JSON serialisation returns "350" not {s,e,d}
  const listings = rawListings.map((l) => ({ ...l, price: l.price.toString() }));

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
        module: input.module,
        price: input.price,
        status: 'DRAFT',
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
      WHERE id = ${listingId}
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

    const updated = await tx.listing.update({
      where: { id: listingId },
      data: { status: newStatus },
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
