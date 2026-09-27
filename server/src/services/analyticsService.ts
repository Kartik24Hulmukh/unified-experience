import { prisma } from '@/lib/prisma';

export const ANALYTICS_RETENTION_DAYS = 30;

export async function pruneAnalyticsEvents(now = new Date()) {
  return prisma.analyticsEvent.deleteMany({
    where: { receivedAt: { lt: new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 86400000) } },
  });
}

/** Activity counts, NOT a cohort conversion funnel. Client telemetry is untrusted. */
export async function getAnalyticsFunnel(days: number, now = new Date()) {
  const since = new Date(now.getTime() - days * 86400000);
  const createdAt = { gte: since, lte: now };
  const [registeredUsers, verifiedUsers, listingsCreated, requestsCreated, completedRequests, events] = await prisma.$transaction([
    prisma.user.count({ where: { createdAt } }),
    prisma.user.count({ where: { createdAt, verified: true } }),
    prisma.listing.count({ where: { createdAt } }),
    prisma.request.count({ where: { createdAt } }),
    prisma.request.count({ where: { createdAt, status: 'COMPLETED' } }),
    prisma.$queryRaw<Array<{ name: string; count: number }>>`SELECT name, count(*)::int AS count FROM analytics_events WHERE received_at >= ${since} AND received_at <= ${now} GROUP BY name ORDER BY name`,
  ], { isolationLevel: 'RepeatableRead' });
  return {
    since: since.toISOString(), until: now.toISOString(), days,
    methodology: 'Records created in the window; verified/completed reflect current status, not transition time. These are activity counts, not sequential cohort conversion rates. Client events are untrusted and may include retries.',
    registeredUsers, verifiedUsers, listingsCreated, requestsCreated, completedRequests,
    clientEvents: events,
  };
}
