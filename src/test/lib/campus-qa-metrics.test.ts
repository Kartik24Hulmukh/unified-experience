import { describe, expect, it } from 'vitest';
import { formatAnswerRate, parseCampusQaMetrics } from '@/lib/campus-qa-metrics';
const week = { weekStart: '2026-09-28', answered: 3, unanswered: 1, total: 4, reopened: 1, observedDays: 2, partial: true, answerRate: 0.75 };
const payload = { since: '2026-09-28T00:00:00.000Z', until: '2026-10-01T00:00:00.000Z', timezone: 'UTC', methodology: 'Observed server requests', weeks: [week] };
describe('weekly evidence contract', () => {
  it('distinguishes no observations from zero successful matches', () => {
    expect(formatAnswerRate(null)).toBe('No observations');
    expect(formatAnswerRate(0)).toBe('0.0%');
    expect(formatAnswerRate(0.755)).toBe('75.5%');
  });
  it('accepts valid data and strips unrequested fields', () => {
    expect(parseCampusQaMetrics({ ...payload, queryText: 'never display this' })).toEqual(payload);
  });
  it('rejects missing, negative, unbounded, and contradictory data', () => {
    for (const value of [undefined, {}, { ...payload, weeks: Array(13).fill(week) },
      { ...payload, weeks: [{ ...week, answered: -1 }] },
      { ...payload, weeks: [{ ...week, total: 0 }] },
      { ...payload, weeks: [{ ...week, answerRate: null }] },
      { ...payload, weeks: [{ ...week, answerRate: 0.99 }] }]) {
      expect(() => parseCampusQaMetrics(value)).toThrow();
    }
  });
  it('accepts explicitly empty weeks', () => {
    expect(parseCampusQaMetrics({ ...payload, weeks: [{ ...week, answered: 0, unanswered: 0, total: 0, answerRate: null }] }).weeks[0].answerRate).toBeNull();
  });
});
