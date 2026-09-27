import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), findMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { campusQaDailyMetric: mocks } }));
import { getCampusQaWeeklyMetrics, recordCampusQaOutcome, summarizeCampusQaWeeks, utcDay, utcMonday } from '@/services/campusQaMetricsService';
beforeEach(() => vi.resetAllMocks());
const now = new Date('2026-10-05T12:00:00Z');
describe('weekly Q&A evidence', () => {
  it('uses Monday UTC boundaries across Sunday, month and year changes', () => {
    expect(utcMonday(new Date('2026-10-04T23:59:59Z')).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(utcMonday(new Date('2027-01-01T01:00:00Z')).toISOString()).toBe('2026-12-28T00:00:00.000Z');
    expect(utcDay(now).toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
  it('zero-fills missing weeks without inventing 0% success or backfill', () => {
    const out = summarizeCampusQaWeeks([], 3, now);
    expect(out.weeks.map(w => w.weekStart)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
    expect(out.weeks.map(w => w.answerRate)).toEqual([null, null, null]);
    expect(out.weeks.map(w => w.partial)).toEqual([false, false, true]);
  });
  it('uses weighted counts rather than averaging daily percentages; bounds the window', () => {
    const out = summarizeCampusQaWeeks([
      { day: new Date('2026-09-28'), answered: 1, unanswered: 0, reopened: 1 },
      { day: new Date('2026-10-04'), answered: 0, unanswered: 9, reopened: 2 },
      { day: new Date('2026-10-05'), answered: 4, unanswered: 0, reopened: 0 },
      { day: new Date('2026-10-06'), answered: 99, unanswered: 0, reopened: 0 },
      { day: new Date('2026-09-20'), answered: 99, unanswered: 0, reopened: 0 },
    ], 2, now);
    expect(out.weeks[0]).toMatchObject({ total: 10, answerRate: 0.1, reopened: 3, observedDays: 2 });
    expect(out.weeks[1]).toMatchObject({ total: 4, answerRate: 1 });
  });
  it('bounds expensive windows even outside the HTTP handler', async () => {
    for (const weeks of [0, -1, 13, 1.5, NaN]) await expect(getCampusQaWeeklyMetrics(weeks, now)).rejects.toThrow();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it('stores only UTC date and outcome increments, using atomic upserts', async () => {
    mocks.upsert.mockResolvedValue({});
    expect(await recordCampusQaOutcome(true, now)).toBe(true);
    expect(mocks.upsert).toHaveBeenLastCalledWith({ where: { day: utcDay(now) }, create: { day: utcDay(now), answered: 1 }, update: { answered: { increment: 1 } } });
    await recordCampusQaOutcome(false, now);
    expect(mocks.upsert.mock.calls[1][0].update).toEqual({ unanswered: { increment: 1 } });
  });
  it('contains telemetry write failure but does not mask failed admin reads as zeros', async () => {
    mocks.upsert.mockRejectedValue(new Error('offline'));
    expect(await recordCampusQaOutcome(false, now)).toBe(false);
    mocks.findMany.mockRejectedValue(new Error('offline'));
    await expect(getCampusQaWeeklyMetrics(8, now)).rejects.toThrow('offline');
  });
});
