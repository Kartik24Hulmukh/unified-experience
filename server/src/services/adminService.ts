/**
 * BErozgar — Admin Service
 *
 * Administrative operations: pending reviews, stats, user management,
 * audit trail, fraud analysis, integrity checks, recovery.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/errors/index';
import { ADMIN_REGISTRY } from '@/config/constants';
import { computeTrust } from '@/domain/trustEngine';
import { evaluateFraudHeuristics } from '@/domain/fraudHeuristics';
import { computeRestriction } from '@/domain/restrictionEngine';

/* ═══════════════════════════════════════════════════
   Pending Listings (awaiting admin review)
   ═══════════════════════════════════════════════════ */

export async function getPendingListings() {
  return prisma.listing.findMany({
    where: { status: 'PENDING_REVIEW' },
    include: { owner: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

/* ═══════════════════════════════════════════════════
   Platform Stats
   ═══════════════════════════════════════════════════ */

export async function getStats() {
  const [
    totalUsers,
    totalListings,
    pendingListings,
    activeDisputes,
    totalRequests,
    completedExchanges,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.request.count(),
    prisma.request.count({ where: { status: 'COMPLETED' } }),
  ]);

  return {
    totalUsers,
    totalListings,
    pendingListings,
    activeDisputes,
    totalRequests,
    completedExchanges,
  };
}

/* ═══════════════════════════════════════════════════
   User Drilldown
   ═══════════════════════════════════════════════════ */

export async function getUserDrilldown(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      listings: { orderBy: { createdAt: 'desc' }, take: 20 },
      buyerRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      sellerRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      disputes: { orderBy: { createdAt: 'desc' }, take: 10 },
      disputesAgainst: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  // Count disputes raised against this user (direct FK)
  const disputesAgainstCount = await prisma.dispute.count({
    where: { againstId: userId },
  });

  const activeDisputeCount = await prisma.dispute.count({
    where: {
      againstId: userId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
    },
  });

  // Compute trust, fraud, restriction from live data
  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const trust = computeTrust({
    completedExchanges: user.completedExchanges,
    cancelledRequests: user.cancelledRequests,
    disputes: disputesAgainstCount,
    adminFlags: user.adminFlags,
    accountAgeDays,
  });

  const fraud = evaluateFraudHeuristics({
    recentListings: user.listings.filter(
      (l) => Date.now() - l.createdAt.getTime() < 86_400_000,
    ).length,
    recentCancellations: user.cancelledRequests,
    recentDisputes: activeDisputeCount,
    accountAgeDays,
  });

  const restriction = computeRestriction({
    trustStatus: trust.status,
    activeDisputes: activeDisputeCount,
    adminOverride: false,
  });

  const { password: _, ...safeUser } = user;

  return {
    user: safeUser,
    trust,
    fraud,
    restriction,
  };
}

/* ═══════════════════════════════════════════════════
   Audit Trail
   ═══════════════════════════════════════════════════ */

export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  action?: string;
}) {
  const page = options.page ?? 1;
  const limit = Math.min(options.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where = options.action ? { action: options.action } : {};

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Create an audit log entry.
 * Called from POST /admin/audit and internally for server-side actions.
 */
import { Prisma } from '@prisma/client';

export async function createAuditLog(data: {
  actorId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  actorRole?: string;
  ipAddress?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: data.actorId,
      action: data.action,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      actorRole: data.actorRole ?? null,
      ipAddress: data.ipAddress ?? null,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
  });
}

/* ═══════════════════════════════════════════════════
   Verify Admin Registry
   ═══════════════════════════════════════════════════ */

/**
 * Check if a user email is in the ADMIN_REGISTRY.
 * Only registered admins may perform SUPER-level operations.
 */
export function isRegisteredAdmin(email: string): boolean {
  return ADMIN_REGISTRY.includes(email.toLowerCase());
}

/**
 * Require SUPER privilege level for critical admin operations.
 */
export async function requireSuperPrivilege(actorId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { email: true, role: true, privilegeLevel: true },
  });

  if (!actor || actor.role !== 'ADMIN') {
    throw new ForbiddenError('Admin role required');
  }

  if (actor.privilegeLevel !== 'SUPER') {
    throw new ForbiddenError('SUPER privilege level required for this operation');
  }

  if (!isRegisteredAdmin(actor.email)) {
    throw new ForbiddenError('Not in admin registry');
  }
}

/* ═══════════════════════════════════════════════════
   Fraud Overview
   ═══════════════════════════════════════════════════ */

export async function getFraudOverview() {
  // Get all users with potential fraud signals
  const users = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      OR: [
        { adminFlags: { gte: 1 } },
        { cancelledRequests: { gte: 3 } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      completedExchanges: true,
      cancelledRequests: true,
      adminFlags: true,
      createdAt: true,
      _count: {
        select: {
          listings: true,
          disputes: true,
        },
      },
    },
    orderBy: { adminFlags: 'desc' },
    take: 50,
  });

  return users.map((u) => {
    const accountAgeDays = Math.floor(
      (Date.now() - u.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const heuristics = evaluateFraudHeuristics({
      recentListings: 0, // Would need time-windowed query for real data
      recentCancellations: u.cancelledRequests,
      recentDisputes: u._count.disputes,
      accountAgeDays,
    });
    return { ...u, heuristics };
  });
}

/* ═══════════════════════════════════════════════════
   Integrity Check
   ═══════════════════════════════════════════════════ */

export async function getIntegrityReport() {
  // Orphaned requests (listing deleted/removed)
  const orphanedRequests = await prisma.request.count({
    where: { listing: { status: 'REMOVED' } },
  });

  // Stale pending (pending > 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const stalePending = await prisma.listing.count({
    where: {
      status: 'PENDING_REVIEW',
      createdAt: { lt: sevenDaysAgo },
    },
  });

  // Expired refresh tokens not cleaned
  const expiredTokens = await prisma.refreshToken.count({
    where: { expiresAt: { lt: new Date() }, revokedAt: null },
  });

  return {
    orphanedRequests,
    stalePending,
    expiredTokens,
    checkedAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════
   Stale Transaction Recovery
   ═══════════════════════════════════════════════════ */

export async function recoverStaleTransactions() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return prisma.$transaction(async (tx) => {
    // Expire stale sent requests
    const expiredRequests = await tx.request.updateMany({
      where: {
        status: 'SENT',
        updatedAt: { lt: sevenDaysAgo },
      },
      data: { status: 'EXPIRED' },
    });

    // Revoke expired refresh tokens
    const revokedTokens = await tx.refreshToken.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    // Clean expired idempotency keys
    const deletedKeys = await tx.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return {
      expiredRequests: expiredRequests.count,
      revokedTokens: revokedTokens.count,
      deletedIdempotencyKeys: deletedKeys.count,
      recoveredAt: new Date().toISOString(),
    };
  });
}
