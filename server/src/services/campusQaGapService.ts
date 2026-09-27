/**
 * BErozgar - Campus Q&A gap logging (APODEX continuation i)
 *
 * Closes the corpus feedback loop: when the deterministic Q&A engine honestly
 * refuses a query (matched: false), the NORMALIZED query text is aggregated so
 * reviewers can see what students actually ask and grow the reviewed corpus
 * where demand is.
 *
 * Privacy by construction:
 *  - only unmatched queries are stored (never an answered one),
 *  - no user id, no IP, no session: the row is a pure demand signal,
 *  - queries containing PII-shaped tokens (email, phone, id numbers) are
 *    dropped outright rather than stored redacted,
 *  - text is lowercased, whitespace-collapsed and capped at 200 chars,
 *  - deduplicated by sha256 hash so repeats aggregate into `hits`.
 *
 * Reliability: a logging failure never degrades the public Q&A response.
 */

import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { utcDay } from '@/services/campusQaMetricsService';

export const MAX_GAP_QUERY_LENGTH = 200;
const MIN_GAP_TOKENS = 2;

export const PII_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, // email address
  /\+?\d[\d\s-]{7,}\d/,                     // phone-shaped digit run
  /\b\d{12,}\b/,                            // aadhaar / id-number run
];

/** Normalize a raw query into a storable demand signal, or null if unsafe/too thin. */
export function normalizeGapQuery(raw: string): string | null {
  const normalized = (raw ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_GAP_QUERY_LENGTH);
  if (PII_PATTERNS.some((re) => re.test(normalized))) return null;
  const tokens = normalized.split(' ').filter((t) => t.length > 1);
  if (tokens.length < MIN_GAP_TOKENS) return null;
  return normalized;
}

export function gapQueryHash(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

/** Aggregate one unmatched query. Resolves false (never throws) if storage fails. */
export async function recordUnmatchedQuery(raw: string): Promise<boolean> {
  const normalized = normalizeGapQuery(raw);
  if (!normalized) return false;
  const queryHash = gapQueryHash(normalized);
  try {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Upsert first to lock even an already-open gap against concurrent
      // publication. Never clear resolvedAt here: the conditional update below
      // owns the transition and its counter in the same transaction.
      await tx.campusQaGap.upsert({
        where: { queryHash },
        create: { queryHash, queryText: normalized, hits: 1, lastSeenAt: now },
        update: { hits: { increment: 1 }, lastSeenAt: now },
      });
      const reopened = await tx.campusQaGap.updateMany({
        where: { queryHash, resolvedAt: { not: null } }, data: { resolvedAt: null },
      });
      if (reopened.count > 0) {
        await tx.campusQaDailyMetric.upsert({
          where: { day: utcDay(now) },
          create: { day: utcDay(now), reopened: reopened.count },
          update: { reopened: { increment: reopened.count } },
        });
      }
    });
    return true;
  } catch {
    return false;
  }
}

/** Top demand gaps for admins: where the reviewed corpus must grow next. */
export async function topCampusQaGaps(limit: number) {
  return prisma.campusQaGap.findMany({
    where: { resolvedAt: null },
    orderBy: [{ hits: 'desc' }, { lastSeenAt: 'desc' }],
    take: limit,
    select: { queryText: true, hits: true, lastSeenAt: true },
  });
}
