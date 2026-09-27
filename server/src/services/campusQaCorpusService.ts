/**
 * RGIT Rozgar - Admin-reviewed campus answers (APODEX continuation k)
 *
 * Closes the last manual step of the corpus feedback loop: an admin turns a
 * demand gap straight into a reviewed, cited answer stored in the database.
 * The deterministic engine merges these with the static in-repo corpus, the
 * gap is marked resolved, and if students keep asking it unmatched the gap
 * reopens automatically (see campusQaGapService.recordUnmatchedQuery).
 *
 * Safety contract (same as the static corpus):
 *  - only ADMIN can write; every answer must cite a reviewed source,
 *  - PII-shaped text (emails, phone numbers, id runs) is rejected outright,
 *  - answers are plain text, length-capped, never user-generated content,
 *  - the public engine keeps working from the static corpus if the DB is down.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { KnowledgeEntry } from '@/data/campusKnowledge';
import { setReviewedAnswers, tokenize } from '@/services/campusQaService';
import { PII_PATTERNS, gapQueryHash, normalizeGapQuery } from '@/services/campusQaGapService';

export const REVIEWED_ID_PREFIX = 'reviewed-';
export const CORPUS_REFRESH_MS = 60_000;
const TOPICS = ['account', 'exchange', 'safety', 'privacy', 'directory', 'support'] as const;

const noPii = (value: string) => !PII_PATTERNS.some((re) => re.test(value));
const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

/** A citation is either a reviewed in-repo document or an https page. */
export function isValidSource(source: string): boolean {
  if (/^(docs|README|SECURITY|src|server)[\w./-]*$/i.test(source) && !source.includes('..')) return true;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const createReviewedAnswerSchema = z.object({
  gapQuery: z.string().max(200).optional(),
  question: z.string().transform(clean).pipe(z.string().min(8).max(200)).refine(noPii, 'question must not contain personal data'),
  answer: z.string().transform(clean).pipe(z.string().min(20).max(1200)).refine(noPii, 'answer must not contain personal data'),
  topic: z.enum(TOPICS),
  source: z.string().trim().min(3).max(300).refine(isValidSource, 'source must be an in-repo docs path or an https URL'),
  keywords: z.array(z.string().trim().toLowerCase().min(2).max(30)).max(15).optional(),
});
export type CreateReviewedAnswerInput = z.infer<typeof createReviewedAnswerSchema>;

/** Deterministic slug: readable prefix + short hash so edits of similar questions never collide. */
export function reviewedSlug(question: string): string {
  const base = question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'answer';
  const suffix = createHash('sha256').update(question.toLowerCase()).digest('hex').slice(0, 8);
  return `${base}-${suffix}`;
}

/** Keywords = admin-provided + tokens of the original student phrasing, so the gap itself matches. */
export function deriveKeywords(input: Pick<CreateReviewedAnswerInput, 'keywords' | 'gapQuery' | 'question'>): string[] {
  const set = new Set<string>();
  for (const k of input.keywords ?? []) if (k) set.add(k);
  for (const t of tokenize(`${input.gapQuery ?? ''} ${input.question}`)) set.add(t);
  return [...set].slice(0, 15);
}

interface AnswerRow {
  slug: string;
  question: string;
  answer: string;
  topic: string;
  keywords: string[];
  source: string;
}

export function toKnowledgeEntry(row: AnswerRow): KnowledgeEntry | null {
  if (!(TOPICS as readonly string[]).includes(row.topic)) return null;
  return {
    id: `${REVIEWED_ID_PREFIX}${row.slug}`,
    question: row.question,
    answer: row.answer,
    source: row.source,
    topic: row.topic as KnowledgeEntry['topic'],
    keywords: row.keywords,
  };
}

let lastAttemptAt = 0;
let inflight: Promise<number> | null = null;

/** Reload published answers into the engine. Never throws; keeps the last good corpus on failure. */
export async function refreshReviewedAnswers(): Promise<number> {
  lastAttemptAt = Date.now();
  try {
    const rows = await prisma.campusQaAnswer.findMany({
      where: { published: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { slug: true, question: true, answer: true, topic: true, keywords: true, source: true },
    });
    return setReviewedAnswers(rows.map(toKnowledgeEntry).filter((e): e is KnowledgeEntry => e !== null));
  } catch {
    return -1;
  }
}

/** TTL-gated refresh for the public path (keeps multi-instance deploys consistent within a minute). */
export async function ensureReviewedAnswersFresh(now = Date.now()): Promise<void> {
  if (now - lastAttemptAt < CORPUS_REFRESH_MS) return;
  if (!inflight) inflight = refreshReviewedAnswers().finally(() => { inflight = null; });
  await inflight;
}

/** Test hook. */
export function resetReviewedAnswersCache(): void {
  lastAttemptAt = 0;
  inflight = null;
}

const ADMIN_SELECT = {
  id: true, slug: true, question: true, answer: true, topic: true, keywords: true,
  source: true, published: true, createdAt: true, updatedAt: true,
} as const;

export async function createReviewedAnswer(input: CreateReviewedAnswerInput, adminId: string | null) {
  const slug = reviewedSlug(input.question);
  const keywords = deriveKeywords(input);
  const normalizedGap = input.gapQuery ? normalizeGapQuery(input.gapQuery) : null;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.campusQaAnswer.upsert({
      where: { slug },
      create: { slug, question: input.question, answer: input.answer, topic: input.topic, keywords, source: input.source, published: true, createdById: adminId },
      update: { answer: input.answer, topic: input.topic, keywords, source: input.source, published: true },
      select: ADMIN_SELECT,
    });
    let resolvedGaps = 0;
    if (normalizedGap) {
      const res = await tx.campusQaGap.updateMany({
        where: { queryHash: gapQueryHash(normalizedGap) },
        data: { resolvedAt: new Date(), answerId: row.id },
      });
      resolvedGaps = res.count;
    }
    return { ...row, resolvedGaps };
  });

  await refreshReviewedAnswers();
  return created;
}

export async function listReviewedAnswers(limit = 100) {
  return prisma.campusQaAnswer.findMany({ orderBy: { updatedAt: 'desc' }, take: limit, select: ADMIN_SELECT });
}

export async function setReviewedAnswerPublished(id: string, published: boolean) {
  const row = await prisma.campusQaAnswer.update({ where: { id }, data: { published }, select: ADMIN_SELECT });
  if (!published) {
    // Unpublishing puts the demand back in the queue instead of silently losing it.
    await prisma.campusQaGap.updateMany({ where: { answerId: id }, data: { resolvedAt: null } });
  }
  await refreshReviewedAnswers();
  return row;
}
