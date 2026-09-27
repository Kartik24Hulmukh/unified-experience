/**
 * BErozgar / RGIT Rozgar - Campus Q&A retrieval (APODEX priority: campus Q&A
 * over a reviewed public document set).
 *
 * Deterministic lexical retrieval (IDF-weighted, field-boosted) over
 * CAMPUS_KNOWLEDGE. No network, no LLM, no user-generated content, no PII:
 * the same question always yields the same cited answer, and an answer can
 * only ever come from a reviewed in-repo document.
 *
 * Low-confidence queries are REFUSED (matched: false) with suggestions rather
 * than answered badly - an honest refusal beats a hallucination on a safety question.
 */

import { CAMPUS_KNOWLEDGE, type KnowledgeEntry } from '@/data/campusKnowledge';

export interface CampusAnswer {
  matched: boolean;
  confidence: number;
  query: string;
  answer: string | null;
  entry: { id: string; question: string; topic: KnowledgeEntry['topic']; source: string } | null;
  related: { id: string; question: string; topic: KnowledgeEntry['topic'] }[];
  disclaimer: string;
}

const STOPWORDS = new Set([
  'a','an','the','is','are','am','was','were','be','been','do','does','did','to','of','in','on','at','for','from','by','with','and','or','if','it','its','this','that','these','those','i','me','my','we','our','you','your','he','she','they','them','as','so','than','then','there','here','what','how','when','where','which','who','why','can','could','should','would','will','shall','may','might','must','have','has','had','get','got','any','some','about','please','tell','know','need','want','hi','hello',
]);

const MAX_QUERY_LENGTH = 200;
const CONFIDENCE_FLOOR = 0.18;

const DISCLAIMER =
  'Answers come only from reviewed RGIT Rozgar documents. For medical emergencies call 108 or 112. Never share OTPs, UPI PINs or bank credentials with anyone.';

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

interface IndexedEntry {
  entry: KnowledgeEntry;
  weights: Map<string, number>;
}

const FIELD_BOOST = { keyword: 3, question: 2, answer: 1 } as const;

function buildIndex(entries: readonly KnowledgeEntry[]): { indexed: IndexedEntry[]; idf: Map<string, number> } {
  const documentFrequency = new Map<string, number>();
  const indexed: IndexedEntry[] = entries.map((entry) => {
    const weights = new Map<string, number>();
    const add = (text: string, boost: number) => {
      for (const [term, count] of termFrequency(tokenize(text))) {
        weights.set(term, (weights.get(term) ?? 0) + count * boost);
      }
    };
    add(entry.keywords.join(' '), FIELD_BOOST.keyword);
    add(entry.question, FIELD_BOOST.question);
    add(entry.answer, FIELD_BOOST.answer);
    for (const term of weights.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    return { entry, weights };
  });

  const total = entries.length || 1;
  const idf = new Map<string, number>();
  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log(1 + total / df));
  }
  return { indexed, idf };
}

/**
 * Active corpus = static reviewed in-repo entries + admin-reviewed DB answers
 * (APODEX continuation k). Static entries always win an id collision, and the
 * index is rebuilt atomically so a query never sees a half-built corpus.
 */
let ACTIVE_ENTRIES: readonly KnowledgeEntry[] = CAMPUS_KNOWLEDGE;
let { indexed: INDEX, idf: IDF } = buildIndex(ACTIVE_ENTRIES);

/** Replace the DB-sourced part of the corpus. Returns the number of reviewed entries accepted. */
export function setReviewedAnswers(entries: readonly KnowledgeEntry[]): number {
  const staticIds = new Set(CAMPUS_KNOWLEDGE.map((e) => e.id));
  const seen = new Set<string>();
  const accepted = entries.filter((e) => {
    if (!e || staticIds.has(e.id) || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  const next = [...CAMPUS_KNOWLEDGE, ...accepted];
  const built = buildIndex(next);
  ACTIVE_ENTRIES = next;
  INDEX = built.indexed;
  IDF = built.idf;
  return accepted.length;
}

export function activeKnowledge(): readonly KnowledgeEntry[] {
  return ACTIVE_ENTRIES;
}

function scoreEntry(queryTokens: string[], candidate: IndexedEntry): number {
  let score = 0;
  let ceiling = 0;
  for (const token of queryTokens) {
    const weight = IDF.get(token) ?? Math.log(2);
    ceiling += weight * FIELD_BOOST.keyword;
    const hit = candidate.weights.get(token);
    if (hit) score += weight * Math.min(hit, FIELD_BOOST.keyword);
  }
  return ceiling === 0 ? 0 : score / ceiling;
}

/** Public, reviewed question list - powers suggestion chips and SEO pages. */
export function listCampusQuestions(): { id: string; question: string; topic: KnowledgeEntry['topic']; source: string }[] {
  return ACTIVE_ENTRIES.map(({ id, question, topic, source }) => ({ id, question, topic, source }));
}

export function answerCampusQuestion(rawQuery: string): CampusAnswer {
  const query = (rawQuery ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  const tokens = tokenize(query);

  const fallbackRelated = CAMPUS_KNOWLEDGE.slice(0, 3).map(({ id, question, topic }) => ({ id, question, topic }));

  if (tokens.length === 0) {
    return { matched: false, confidence: 0, query, answer: null, entry: null, related: fallbackRelated, disclaimer: DISCLAIMER };
  }

  const ranked = INDEX.map((candidate) => ({ candidate, score: scoreEntry(tokens, candidate) })).sort(
    (a, b) => b.score - a.score || a.candidate.entry.id.localeCompare(b.candidate.entry.id),
  );

  const best = ranked[0];
  const related = ranked
    .slice(1, 4)
    .filter((r) => r.score > 0)
    .map((r) => ({ id: r.candidate.entry.id, question: r.candidate.entry.question, topic: r.candidate.entry.topic }));

  if (!best || best.score < CONFIDENCE_FLOOR) {
    return {
      matched: false,
      confidence: Number((best?.score ?? 0).toFixed(3)),
      query,
      answer: null,
      entry: null,
      related: related.length > 0 ? related : fallbackRelated,
      disclaimer: DISCLAIMER,
    };
  }

  const { entry } = best.candidate;
  return {
    matched: true,
    confidence: Number(best.score.toFixed(3)),
    query,
    answer: entry.answer,
    entry: { id: entry.id, question: entry.question, topic: entry.topic, source: entry.source },
    related,
    disclaimer: DISCLAIMER,
  };
}
