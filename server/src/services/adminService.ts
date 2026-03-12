/**
 * BErozgar — Admin Service
 *
 * Administrative operations: pending reviews, stats, user management,
 * audit trail, fraud analysis, integrity checks, recovery.
 */

import { prisma } from '@/lib/prisma';
import { RequestStatus } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '@/errors/index';
import { ADMIN_REGISTRY } from '@/config/constants';
import { computeTrust } from '@/domain/trustEngine';
import { evaluateFraudHeuristics } from '@/domain/fraudHeuristics';
import { computeRestriction } from '@/domain/restrictionEngine';

/* ═══════════════════════════════════════════════════
   Pending Listings (awaiting admin review)
   ═══════════════════════════════════════════════════ */

export async function getPendingListings() {
  const listings = await prisma.listing.findMany({
    where: { status: 'PENDING_REVIEW' },
    include: { owner: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return listings.map((l) => ({ ...l, price: l.price.toString() }));
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
    // MED-05 FIX: read the persisted restriction flag from the DB rather than
    // hardcoding false. isRestricted is the admin-managed override field on the
    // User model — hardcoding false meant admin-overridden users always appeared
    // unrestricted in the admin drilldown, hiding enforcement state from reviewers.
    adminOverride: user.isRestricted,
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
  actorId: string | null;
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

/**
 * Require write-capable privilege level (SUPER or REVIEWER).
 * OBSERVER admins are read-only and cannot approve, reject, flag, or resolve.
 */
export async function requireWritePrivilege(actorId: string): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { role: true, privilegeLevel: true },
  });

  if (!actor || actor.role !== 'ADMIN') {
    throw new ForbiddenError('Admin role required');
  }

  if (actor.privilegeLevel === 'OBSERVER') {
    throw new ForbiddenError('OBSERVER admins have read-only access');
  }
}

/* ═══════════════════════════════════════════════════
   Fraud Overview
   ═══════════════════════════════════════════════════ */

export async function getFraudOverview() {
  // Get all users with potential fraud signals
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);

  const users = await prisma.user.findMany({
    where: {
      role: { in: ['STUDENT_VERIFIED', 'PUBLIC_USER'] },
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
      listings: {
        where: { createdAt: { gte: oneDayAgo } },
        select: { id: true },
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
      recentListings: u.listings.length,
      recentCancellations: u.cancelledRequests,
      recentDisputes: u._count.disputes,
      accountAgeDays,
    });
    const { listings: _recentListings, ...userData } = u;
    return { ...userData, heuristics };
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

// CORR-3 FIX: module-level concurrency guard prevents overlapping runs from
// both the scheduled job AND the POST /admin/recovery endpoint. Previously
// only the scheduler in server.ts had a guard — the admin route bypassed it.
let _recoveryRunning = false;

export async function recoverStaleTransactions() {
  if (_recoveryRunning) {
    return { skipped: true, reason: 'Recovery already in progress' };
  }
  _recoveryRunning = true;
  try {
    return await _recoverStaleTransactionsImpl();
  } finally {
    _recoveryRunning = false;
  }
}

async function _recoverStaleTransactionsImpl() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // EXCH-DESIGN-03: ACCEPTED / MEETING_SCHEDULED can be ghosted indefinitely.
  // Give them a longer grace window (14 days) before auto-expiring.
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // HIGH-1 FIX: Replace the single mega-transaction that held locks across
  // requests, listings, refreshToken, idempotencyKey, AND auditLog simultaneously
  // with three independent sequential operations.
  //
  // Rationale for the split:
  //   • requests + listings share a logical dependency (listing reset reads the
  //     request state just written) → kept in one focused transaction.
  //   • refreshToken revocation is independent → standalone query.
  //   • idempotencyKey cleanup is already handled by the 10-minute prune
  //     scheduler (sentinelPrune job) → removed to avoid duplicate deletes.
  //   • auditLog write is independent → written after all logic completes so
  //     it cannot hold locks on the business tables.
  //
  // This eliminates the deadlock window that occurred when the idempotency
  // middleware tried to INSERT a new key while the recovery job held a
  // table-level intent lock via the same transaction.

  const terminalStatuses: RequestStatus[] = ['EXPIRED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'WITHDRAWN', 'RESOLVED'];

  // ── Step 1: Expire stale requests + reset stranded listings ──────────────
  // Kept in one transaction because listing reset depends on request state
  // being committed first (otherwise a request that JUST expired would still
  // appear active and block the listing from being reset).
  const { expiredSent, expiredActive, interestReset, inTransactionReset } =
    await prisma.$transaction(async (tx) => {
      // PROD-04: bump version alongside status change so any concurrent
      // optimistic lock held by a user racing against expiry will correctly
      // conflict instead of silently overwriting the EXPIRED status.
      const _expiredSent = await tx.request.updateMany({
        where: {
          status: 'SENT',
          updatedAt: { lt: sevenDaysAgo },
        },
        data: { status: 'EXPIRED', version: { increment: 1 } },
      });

      // EXCH-DESIGN-03 FIX: expire ghost ACCEPTED / MEETING_SCHEDULED requests
      const _expiredActive = await tx.request.updateMany({
        where: {
          status: { in: ['ACCEPTED', 'MEETING_SCHEDULED'] },
          updatedAt: { lt: fourteenDaysAgo },
        },
        data: { status: 'EXPIRED', version: { increment: 1 } },
      });

      // CRIT-05 FIX: After expiring requests, reset any listings that are now
      // stranded in INTEREST_RECEIVED or IN_TRANSACTION with no remaining active
      // (non-terminal) requests. Without this, a listing whose only request
      // expired could never receive new buyers — it would remain locked forever.
      const _interestReset = await tx.listing.updateMany({
        where: {
          status: 'INTEREST_RECEIVED',
          requests: { none: { status: { notIn: terminalStatuses } } },
        },
        data: { status: 'APPROVED' },
      });

      const _inTransactionReset = await tx.listing.updateMany({
        where: {
          status: 'IN_TRANSACTION',
          requests: { none: { status: { notIn: terminalStatuses } } },
        },
        data: { status: 'APPROVED' },
      });

      return {
        expiredSent: _expiredSent,
        expiredActive: _expiredActive,
        interestReset: _interestReset,
        inTransactionReset: _inTransactionReset,
      };
    });

  // ── Step 2: Revoke expired refresh tokens (independent, no tx needed) ────
  const revokedTokens = await prisma.refreshToken.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  // Step 3: idempotencyKey cleanup intentionally removed — the 10-minute
  // sentinelPrune scheduler already handles this. Duplicating it here would
  // cause redundant deletes and contention with concurrent API requests.

  // ── Step 4: Audit log (independent write after all logic is committed) ────
  const expiredRequestsCount = expiredSent.count + expiredActive.count;
  const recoveredListings = interestReset.count + inTransactionReset.count;

  // HIGH-06 FIX: log per-batch counts so ops can trace which expiry type
  // triggered a listing recovery, instead of a single opaque aggregate.
  await prisma.auditLog.create({
    data: {
      actorId: null, // SYSTEM
      action: 'SYSTEM_RECOVERY',
      entityType: 'System',
      metadata: {
        expiredRequests: expiredRequestsCount,
        expiredSentRequests: expiredSent.count,
        expiredActiveRequests: expiredActive.count,
        recoveredListings,
        recoveredInterestReceived: interestReset.count,
        recoveredInTransaction: inTransactionReset.count,
        revokedTokens: revokedTokens.count,
      },
    },
  });

  return {
    expiredRequests: expiredRequestsCount,
    recoveredListings,
    revokedTokens: revokedTokens.count,
    recoveredAt: new Date().toISOString(),
  };
}
