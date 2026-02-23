/**
 * BErozgar — Listing Service
 *
 * CRUD and FSM transitions for listings.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/errors/index';
import { InvalidTransitionError } from '@/errors/index';
import { PAGINATION } from '@/config/constants';
import type { CreateListingInput, UpdateListingStatusInput } from '@/shared/validation';
import type { ListingStatus, Prisma } from '@prisma/client';

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

export async function createListing(
  input: CreateListingInput,
  userId: string,
) {
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

// Map from status update input to the FSM-style status
const STATUS_MAP: Record<string, ListingStatus> = {
  approved: 'APPROVED',
  rejected: 'REJECTED',
  pending_review: 'PENDING_REVIEW',
};

export async function updateListingStatus(
  listingId: string,
  input: UpdateListingStatusInput,
  actorId: string,
  actorRole: string,
) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundError('Listing', listingId);
    }

    // Only admins can approve/reject
    if (
      (input.status === 'approved' || input.status === 'rejected') &&
      actorRole !== 'ADMIN'
    ) {
      throw new ForbiddenError('Only admins can approve or reject listings');
    }

    const newStatus = STATUS_MAP[input.status];
    if (!newStatus) {
      throw new InvalidTransitionError('Listing', listing.status, input.status);
    }

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
        metadata: { from: listing.status, to: newStatus },
      },
    });

    return updated;
  });
}
