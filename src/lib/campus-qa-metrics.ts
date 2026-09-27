import { z } from 'zod';

export const CAMPUS_QA_METRICS_PATH = '/admin/campus-qa/metrics?weeks=8';
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const weekSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answered: count, unanswered: count, reopened: count, total: count,
  observedDays: count.max(7), partial: z.boolean(), answerRate: z.number().min(0).max(1).nullable(),
}).superRefine((w, ctx) => {
  const expected = w.total === 0 ? null : w.answered / w.total;
  if (w.total !== w.answered + w.unanswered || w.answerRate !== expected) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Inconsistent Q&A denominator' });
  }
});
const metricsSchema = z.object({
  since: z.string().datetime(), until: z.string().datetime(), timezone: z.literal('UTC'),
  methodology: z.string().min(1).max(2000), weeks: z.array(weekSchema).min(1).max(12),
});
export type CampusQaMetrics = z.infer<typeof metricsSchema>;
export function parseCampusQaMetrics(value: unknown): CampusQaMetrics {
  // Throw rather than painting a malformed response as a reassuring zero.
  return metricsSchema.parse(value);
}
export function formatAnswerRate(rate: number | null): string {
  return rate === null ? 'No observations' : `${(rate * 100).toFixed(1)}%`;
}
