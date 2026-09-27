/**
 * Campus Q&A client (APODEX priority: campus Q&A over reviewed public docs,
 * frontend half).
 *
 * Talks ONLY to the anonymous, cacheable, rate-limited public endpoints:
 *   GET /api/public/campus-qa?q=...       - one deterministic, cited answer
 *   GET /api/public/campus-qa/questions   - the full reviewed question list
 *
 * Defence in depth mirrors public-listings.ts: every response is re-shaped
 * client-side into a whitelisted DTO, so a future server regression can never
 * leak unexpected fields into the signed-out UI.
 */
import { api } from '@/lib/api-client';

export interface CampusQaSource {
  id: string;
  question: string;
  topic: string;
  source: string;
}

export interface CampusQaRelated {
  id: string;
  question: string;
  topic: string;
}

export interface CampusAnswer {
  matched: boolean;
  confidence: number;
  query: string;
  answer: string | null;
  entry: CampusQaSource | null;
  related: CampusQaRelated[];
  disclaimer: string;
}

export interface CampusQuestion {
  id: string;
  question: string;
  topic: string;
  source: string;
}

export const MAX_QA_QUERY_LENGTH = 200;

function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function sanitizeRelated(raw: unknown): CampusQaRelated[] {
  if (!Array.isArray(raw)) return [];
  const out: CampusQaRelated[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.question !== 'string') continue;
    out.push({ id: r.id.slice(0, 60), question: r.question.slice(0, 200), topic: clampText(r.topic, 30) });
  }
  return out;
}

/** Re-shape any payload into the whitelisted CampusAnswer DTO. */
export function sanitizeCampusAnswer(raw: unknown): CampusAnswer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const entry =
    r.entry && typeof r.entry === 'object'
      ? (() => {
          const e = r.entry as Record<string, unknown>;
          if (typeof e.id !== 'string' || typeof e.question !== 'string') return null;
          return {
            id: e.id.slice(0, 60),
            question: e.question.slice(0, 200),
            topic: clampText(e.topic, 30),
            source: clampText(e.source, 120),
          } satisfies CampusQaSource;
        })()
      : null;
  return {
    matched: r.matched === true,
    confidence: clampConfidence(r.confidence),
    query: clampText(r.query, MAX_QA_QUERY_LENGTH),
    answer: r.matched === true && typeof r.answer === 'string' ? r.answer.slice(0, 2000) : null,
    entry: r.matched === true ? entry : null,
    related: sanitizeRelated(r.related).slice(0, 3),
    disclaimer: clampText(r.disclaimer, 400),
  };
}

export function sanitizeCampusQuestions(raw: unknown): CampusQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: CampusQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.question !== 'string') continue;
    out.push({
      id: r.id.slice(0, 60),
      question: r.question.slice(0, 200),
      topic: clampText(r.topic, 30),
      source: clampText(r.source, 120),
    });
  }
  return out;
}

export function buildCampusQaPath(query: string): string {
  const q = query.trim().slice(0, MAX_QA_QUERY_LENGTH);
  return `/public/campus-qa?q=${encodeURIComponent(q)}`;
}

/** Ask one question. Throws ApiError on network/rate-limit failure. */
export async function askCampusQuestion(query: string, signal?: AbortSignal): Promise<CampusAnswer> {
  const res = await api.get<{ data: unknown }>(buildCampusQaPath(query), {
    skipAuth: true,
    signal,
    timeout: 8000,
  });
  const answer = sanitizeCampusAnswer(res?.data);
  if (!answer) throw new Error('Malformed campus-qa response');
  return answer;
}

/** Fetch the reviewed question list for suggestion chips / help index. */
export async function fetchCampusQuestions(signal?: AbortSignal): Promise<CampusQuestion[]> {
  const res = await api.get<{ data: unknown }>('/public/campus-qa/questions', {
    skipAuth: true,
    signal,
    timeout: 8000,
  });
  return sanitizeCampusQuestions(res?.data);
}
