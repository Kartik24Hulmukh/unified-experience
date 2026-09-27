/**
 * BErozgar / RGIT Rozgar - Campus Q&A retrieval tests (APODEX continuation g).
 *
 * Pure service tests: no database, no network, no app boot. They lock in the
 * three properties the council required of a campus answer engine:
 *   1. determinism (same question -> same cited answer),
 *   2. citation integrity (every answer names a reviewed in-repo source),
 *   3. honest refusal (out-of-scope questions are NOT answered).
 */

import { describe, it, expect } from 'vitest';
import { answerCampusQuestion, listCampusQuestions, tokenize } from '@/services/campusQaService';
import { CAMPUS_KNOWLEDGE } from '@/data/campusKnowledge';

describe('campusQaService', () => {
  it('answers the core student intents with the right entry', () => {
    const cases: [string, string][] = [
      ['how do I get verified as a student?', 'verify-student'],
      ['where can I safely meet to hand over a book?', 'safe-meetup'],
      ['how do I report a scam?', 'report-fraud'],
      ['is there a mess near college for lunch?', 'mess-directory'],
      ['nearest hospital for a medical emergency', 'hospital-directory'],
      ['how do I delete my account and data?', 'delete-account'],
      ['does the platform take commission fees?', 'fees-free'],
      ['looking for a PG room on rent', 'accommodation'],
    ];
    for (const [query, expectedId] of cases) {
      const result = answerCampusQuestion(query);
      expect(result.matched, query).toBe(true);
      expect(result.entry?.id, query).toBe(expectedId);
    }
  });

  it('is deterministic', () => {
    const a = answerCampusQuestion('how do exchange requests work');
    const b = answerCampusQuestion('how do exchange requests work');
    expect(a).toEqual(b);
  });

  it('cites a reviewed in-repo source on every answer', () => {
    for (const entry of CAMPUS_KNOWLEDGE) {
      const result = answerCampusQuestion(entry.question);
      expect(result.matched, entry.id).toBe(true);
      expect(result.entry?.source, entry.id).toMatch(/^(docs\/|README\.md)/);
    }
  });

  it('refuses out-of-scope questions instead of guessing', () => {
    for (const query of ['who won the cricket world cup', 'write me a poem about quantum gravity', '???']) {
      const result = answerCampusQuestion(query);
      expect(result.matched, query).toBe(false);
      expect(result.answer, query).toBeNull();
      expect(result.related.length, query).toBeGreaterThan(0);
    }
  });

  it('handles empty and oversized input safely', () => {
    expect(answerCampusQuestion('').matched).toBe(false);
    const long = answerCampusQuestion('verification '.repeat(200));
    expect(long.query.length).toBeLessThanOrEqual(200);
  });

  it('never leaks personal data from the knowledge base', () => {
    const corpus = JSON.stringify(CAMPUS_KNOWLEDGE);
    expect(corpus).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(corpus).not.toMatch(/\b[6-9]\d{9}\b/);
  });

  it('exposes a stable, unique, non-empty question list', () => {
    const questions = listCampusQuestions();
    expect(questions.length).toBe(CAMPUS_KNOWLEDGE.length);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    for (const q of questions) expect(q.question.trim().length).toBeGreaterThan(0);
  });

  it('tokenizes away stopwords and punctuation', () => {
    expect(tokenize('How do I  get  VERIFIED?!')).toEqual(['verified']);
  });
});
