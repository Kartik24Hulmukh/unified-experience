/**
 * BErozgar — Profile Service
 *
 * User profile retrieval with computed trust/restriction.
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/errors/index';
import { computeTrust } from '@/domain/trustEngine';
import { computeRestriction } from '@/domain/restrictionEngine';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          listings: true,
          buyerRequests: true,
          disputes: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Count disputes raised against this user (using direct againstId FK)
  const disputesAgainstCount = await prisma.dispute.count({
    where: { againstId: userId },
  });

  const activeDisputesAgainst = await prisma.dispute.count({
    where: {
      againstId: userId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
    },
  });

  const trust = computeTrust({
    completedExchanges: user.completedExchanges,
    cancelledRequests: user.cancelledRequests,
    disputes: disputesAgainstCount,
    adminFlags: user.adminFlags,
    accountAgeDays,
  });

  const restriction = computeRestriction({
    trustStatus: trust.status,
    activeDisputes: activeDisputesAgainst,
    adminOverride: false,
  });

  // Shape the response to match the frontend Profile type
  // (discriminated union: StudentProfile | AdminProfile)
  const identity = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.toLowerCase() as 'student' | 'admin',
    verified: user.verified,
    joinedAt: user.createdAt.toISOString(),
    avatarUrl: null as string | null,
  };

  if (user.role === 'ADMIN') {
    // Admin profile — aggregate system-level stats
    const [totalListings, activeUsers, openDisputes] = await Promise.all([
      prisma.listing.count(),
      prisma.user.count({ where: { verified: true } }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);

    return {
      identity,
      role: 'admin' as const,
      data: {
        totalListings,
        activeUsers,
        openDisputes,
        avgApprovalTimeHours: 0,
        recentActions: 0,
        systemHealthScore: 100,
        totalStudents: activeUsers,
        activeExchanges: 0,
        academicListings: 0,
        systemUptimePercent: 100,
      },
      privilegeLevel: 'SUPER' as const,
    };
  }

  // Student profile
  return {
    identity,
    role: 'student' as const,
    data: {
      listingsCount: user._count.listings,
      requestsCount: user._count.buyerRequests,
      exchangesCompleted: user.completedExchanges,
      valueCirculated: 0,
      activeListings: user._count.listings,
      reputation: Math.min(100, user.completedExchanges * 20 + accountAgeDays),
      cancelledRequests: user.cancelledRequests,
      disputesCount: disputesAgainstCount,
      adminFlags: user.adminFlags,
    },
    trust,
    restriction,
  };
}
