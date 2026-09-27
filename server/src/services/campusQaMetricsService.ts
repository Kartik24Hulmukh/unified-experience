import { prisma } from '@/lib/prisma';

const DAY_MS = 86_400_000;
export function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
export function utcMonday(now: Date): Date {
  const day = utcDay(now);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day;
}

/** Count server observations, not users or verified usefulness. Never store query text. */
export async function recordCampusQaOutcome(matched: boolean, now = new Date()): Promise<boolean> {
  try {
    const key = matched ? 'answered' : 'unanswered';
    await prisma.campusQaDailyMetric.upsert({
      where: { day: utcDay(now) },
      create: { day: utcDay(now), [key]: 1 },
      update: { [key]: { increment: 1 } },
    });
    return true;
  } catch { return false; } // Q&A remains usable during telemetry/database failure.
}

export interface DailyQaMetric { day: Date; answered: number; unanswered: number; reopened: number }
export function summarizeCampusQaWeeks(rows: DailyQaMetric[], weeks: number, now = new Date()) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new RangeError('weeks must be 1–12');
  const current = utcMonday(now);
  const start = new Date(current.getTime() - (weeks - 1) * 7 * DAY_MS);
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(start.getTime() + i * 7 * DAY_MS).toISOString().slice(0, 10),
    answered: 0, unanswered: 0, reopened: 0, observedDays: 0,
    partial: i === weeks - 1,
  }));
  for (const row of rows) {
    if (row.day < start || row.day > utcDay(now)) continue;
    const index = Math.floor((utcMonday(row.day).getTime() - start.getTime()) / (7 * DAY_MS));
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.answered += row.answered;
    bucket.unanswered += row.unanswered;
    bucket.reopened += row.reopened;
    bucket.observedDays += 1;
  }
  return {
    since: start.toISOString(), until: now.toISOString(), timezone: 'UTC',
    methodology: 'Answered / (answered + unanswered) among valid requests observed by this server. Best-effort counters; retries, bots and repeats count, not unique students or answer quality. No historical backfill. Empty weeks mean no observations, not 0% success. Reopened counts resolved-to-open transitions caused by an unmatched query, not manual unpublishing. Current UTC week is partial.',
    weeks: buckets.map(b => ({ ...b, total: b.answered + b.unanswered,
      answerRate: b.answered + b.unanswered === 0 ? null : b.answered / (b.answered + b.unanswered),
    })),
  };
}

export async function getCampusQaWeeklyMetrics(weeks: number, now = new Date()) {
  // Validate before building the query, including when called outside the route.
  const empty = summarizeCampusQaWeeks([], weeks, now);
  const rows = await prisma.campusQaDailyMetric.findMany({
    where: { day: { gte: new Date(empty.since), lte: utcDay(now) } }, orderBy: { day: 'asc' },
  });
  return summarizeCampusQaWeeks(rows, weeks, now);
}
