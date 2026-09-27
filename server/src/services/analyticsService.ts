/**
 * BErozgar — Analytics Service
 *
 * Persists and aggregates analytics events.
 * Supports funnel analysis (conversion tracking) and TTL cleanup.
 */

import { prisma } from '@/lib/prisma';

export interface CreateAnalyticsEventInput {
  name: string;
  level?: 'info' | 'warning' | 'error';
  userId?: string;
  userRole?: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Persist a single analytics event.
 * Automatically calculates 180-day TTL.
 */
export async function createEvent(input: CreateAnalyticsEventInput): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days

  await prisma.analyticsEvent.create({
    data: {
      name: input.name,
      level: input.level ?? 'info',
      userId: input.userId,
      userRole: input.userRole,
      properties: input.properties,
      context: input.context,
      timestamp: input.timestamp ? new Date(input.timestamp) : now,
      expiresAt,
    },
  });
}

/**
 * Get funnel metrics for a sequence of events.
 * Returns count of events by name.
 *
 * Example:
 *   getFunnelMetrics(['listing_created', 'request_sent', 'request_completed'], 7)
 *   Returns: { 'listing_created': 42, 'request_sent': 28, 'request_completed': 15 }
 */
export async function getFunnelMetrics(eventNames: string[], days: number = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await Promise.all(
    eventNames.map(async (eventName) => {
      const count = await prisma.analyticsEvent.count({
        where: {
          name: eventName,
          timestamp: { gte: since },
        },
      });
      return { event: eventName, count };
    })
  );

  return Object.fromEntries(results.map((r) => [r.event, r.count]));
}

/**
 * Delete events older than 180 days (GDPR cleanup).
 */
export async function pruneExpired(): Promise<number> {
  const now = new Date();
  const result = await prisma.analyticsEvent.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });
  return result.count;
}
