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
    adminOverride: user.isRestricted,
    userRole: user.role,
  });

  // Shape the response to match the frontend Profile type
  // (discriminated union: StudentProfile | AdminProfile)
  const identity = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.toLowerCase() as 'student_verified' | 'public_user' | 'admin',
    verified: user.verified,
    joinedAt: user.createdAt.toISOString(),
    avatarUrl: null as string | null,
    collegeLinked: !!user.collegeStudentId,
  };

  if (user.role === 'ADMIN') {
    // Admin profile — aggregate system-level stats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);
    const [totalListings, activeUsers, openDisputes, activeExchanges, recentActions] =
      await Promise.all([
        prisma.listing.count(),
        prisma.user.count({ where: { verified: true } }),
        prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
        prisma.request.count({ where: { status: { in: ['ACCEPTED', 'MEETING_SCHEDULED'] } } }),
        prisma.auditLog.count({ where: { actorId: userId, createdAt: { gte: oneDayAgo } } }),
      ]);

    return {
      identity,
      role: 'admin' as const,
      data: {
        totalListings,
        activeUsers,
        openDisputes,
        avgApprovalTimeHours: 0,
        recentActions,
        systemHealthScore: 100,
        totalStudents: activeUsers,
        activeExchanges,
        academicListings: 0,
        systemUptimePercent: 100,
      },
      privilegeLevel: user.privilegeLevel ?? 'STANDARD',
    };
  }

  // Student profile (both STUDENT_VERIFIED and PUBLIC_USER)
  return {
    identity,
    role: user.role === 'STUDENT_VERIFIED' ? 'student_verified' as const : 'public_user' as const,
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

/**
 * Link a public user's email to the college registry and upgrade to STUDENT_VERIFIED.
 * Checks if the user's current email exists in CollegeStudentRegistry.
 */
export async function linkCollegeEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  if (user.role === 'ADMIN') {
    throw new NotFoundError('User', userId); // Admins don't upgrade
  }

  if (user.role === 'STUDENT_VERIFIED') {
    return { message: 'Your account is already verified as a college student.', upgraded: false };
  }

  const collegeRecord = await prisma.collegeStudent.findUnique({
    where: { officialEmail: user.email.toLowerCase().trim() },
  });

  if (!collegeRecord) {
    return {
      message: 'Your email was not found in the college registry. Contact administration if you believe this is an error.',
      upgraded: false,
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role: 'STUDENT_VERIFIED',
      collegeStudentId: collegeRecord.id,
    },
  });

  return { message: 'Your account has been upgraded to verified college student!', upgraded: true };
}
