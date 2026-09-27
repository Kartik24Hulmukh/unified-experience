/**
 * Admin client helpers for turning a Q&A demand gap into a reviewed, cited
 * answer stored in the database (APODEX continuation k). Mirrors the server
 * contract in server/src/services/campusQaCorpusService.ts so an admin gets
 * instant, specific feedback before the request is sent.
 */

export const CAMPUS_QA_TOPICS = ['account', 'exchange', 'safety', 'privacy', 'directory', 'support'] as const;
export type CampusQaTopic = (typeof CAMPUS_QA_TOPICS)[number];

export const CAMPUS_QA_ANSWERS_PATH = '/admin/campus-qa/answers';

export interface ReviewedAnswerDraft {
  gapQuery?: string;
  question: string;
  answer: string;
  topic: CampusQaTopic;
  source: string;
  keywords: string;
}

export interface ReviewedAnswerRow {
  id: string;
  question: string;
  answer: string;
  topic: string;
  source: string;
  published: boolean;
  updatedAt: string | null;
}

const PII_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\+?\d[\d\s-]{7,}\d/,
  /\b\d{12,}\b/,
];

export function isValidSource(source: string): boolean {
  const s = source.trim();
  if (/^(docs|README|SECURITY|src|server)[\w./-]*$/i.test(s) && !s.includes('..')) return true;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseKeywords(raw: string): string[] {
  const set = new Set<string>();
  for (const k of raw.split(',')) {
    const t = k.trim().toLowerCase();
    if (t.length >= 2 && t.length <= 30) set.add(t);
  }
  return [...set].slice(0, 15);
}

/** Returns field -> message for every problem; an empty object means the draft is publishable. */
export function validateDraft(d: ReviewedAnswerDraft): Partial<Record<keyof ReviewedAnswerDraft, string>> {
  const errors: Partial<Record<keyof ReviewedAnswerDraft, string>> = {};
  const q = d.question.replace(/\s+/g, ' ').trim();
  const a = d.answer.replace(/\s+/g, ' ').trim();
  if (q.length < 8 || q.length > 200) errors.question = 'Question must be 8-200 characters.';
  else if (PII_PATTERNS.some((re) => re.test(q))) errors.question = 'Remove personal data (email, phone, ID numbers).';
  if (a.length < 20 || a.length > 1200) errors.answer = 'Answer must be 20-1200 characters.';
  else if (PII_PATTERNS.some((re) => re.test(a))) errors.answer = 'Remove personal data (email, phone, ID numbers).';
  if (!(CAMPUS_QA_TOPICS as readonly string[]).includes(d.topic)) errors.topic = 'Pick a topic.';
  if (!isValidSource(d.source)) errors.source = 'Cite an in-repo docs path (docs/...) or an https URL.';
  return errors;
}

export function toCreatePayload(d: ReviewedAnswerDraft) {
  const keywords = parseKeywords(d.keywords);
  return {
    ...(d.gapQuery ? { gapQuery: d.gapQuery.slice(0, 200) } : {}),
    question: d.question.replace(/\s+/g, ' ').trim(),
    answer: d.answer.replace(/\s+/g, ' ').trim(),
    topic: d.topic,
    source: d.source.trim(),
    ...(keywords.length ? { keywords } : {}),
  };
}

/** Draft pre-filled from a gap: the student phrasing becomes a tidy question. */
export function draftFromGap(queryText: string): ReviewedAnswerDraft {
  const t = queryText.replace(/\s+/g, ' ').trim();
  const question = t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[?.!]$/.test(t) ? '' : '?'}` : '';
  return { gapQuery: t, question, answer: '', topic: 'support', source: '', keywords: '' };
}

export function sanitizeReviewedAnswers(payload: unknown): ReviewedAnswerRow[] {
  if (!Array.isArray(payload)) return [];
  const rows: ReviewedAnswerRow[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.question !== 'string' || typeof r.answer !== 'string') continue;
    rows.push({
      id: r.id,
      question: r.question.slice(0, 200),
      answer: r.answer.slice(0, 1200),
      topic: typeof r.topic === 'string' ? r.topic : 'support',
      source: typeof r.source === 'string' ? r.source : '',
      published: r.published === true,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    });
    if (rows.length >= 200) break;
  }
  return rows;
}
