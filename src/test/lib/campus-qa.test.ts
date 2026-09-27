import { describe, it, expect } from 'vitest';
import {
  buildCampusQaPath,
  sanitizeCampusAnswer,
  sanitizeCampusQuestions,
  sanitizeRelated,
  MAX_QA_QUERY_LENGTH,
} from '@/lib/campus-qa';

describe('campus-qa client', () => {
  it('trims and caps the query at 200 chars and encodes it', () => {
    const long = 'x'.repeat(500);
    const p = buildCampusQaPath(`  ${long}  `);
    const q = new URLSearchParams(p.split('?')[1]).get('q')!;
    expect(q.length).toBe(MAX_QA_QUERY_LENGTH);
    expect(buildCampusQaPath('is it safe?')).toBe('/public/campus-qa?q=is%20it%20safe%3F');
  });

  it('keeps only whitelisted fields from an answer payload', () => {
    const out = sanitizeCampusAnswer({
      matched: true,
      confidence: 0.82,
      query: 'how do I verify?',
      answer: 'Sign up with your college email…',
      entry: { id: 'verify-student', question: 'How do I get verified?', topic: 'account', source: 'docs/SECURITY.md', secretField: 'leak' },
      related: [{ id: 'a', question: 'Q?', topic: 'support', extra: 'leak' }],
      disclaimer: 'For emergencies call 108.',
      userId: 'leak',
    });
    expect(out).not.toBeNull();
    expect(out!.matched).toBe(true);
    expect(out!.entry).toEqual({ id: 'verify-student', question: 'How do I get verified?', topic: 'account', source: 'docs/SECURITY.md' });
    expect(out!.related).toEqual([{ id: 'a', question: 'Q?', topic: 'support' }]);
    expect(JSON.stringify(out)).not.toContain('leak');
    expect(JSON.stringify(out)).not.toContain('secretField');
  });

  it('nulls the answer and entry when matched is false', () => {
    const out = sanitizeCampusAnswer({
      matched: false,
      confidence: 0.05,
      query: 'quantum physics',
      answer: 'should not be shown',
      entry: { id: 'x', question: 'q', topic: 't', source: 's' },
      related: [],
      disclaimer: 'd',
    });
    expect(out!.answer).toBeNull();
    expect(out!.entry).toBeNull();
  });

  it('clamps confidence into [0,1] and rejects malformed payloads', () => {
    expect(sanitizeCampusAnswer({ matched: true, confidence: 99, answer: 'a', related: [], disclaimer: '' })!.confidence).toBe(1);
    expect(sanitizeCampusAnswer({ matched: true, confidence: 'bad', answer: 'a', related: [], disclaimer: '' })!.confidence).toBe(0);
    expect(sanitizeCampusAnswer(null)).toBeNull();
    expect(sanitizeCampusAnswer('nope')).toBeNull();
    expect(sanitizeCampusAnswer([])).toBeNull();
  });

  it('sanitizes related questions and caps at 3', () => {
    const related = sanitizeRelated([
      { id: '1', question: 'One?', topic: 'account' },
      { id: '2', question: 'Two?', topic: 'safety' },
      { id: '3', question: 'Three?', topic: 'privacy' },
      { id: '4', question: 'Four?', topic: 'support' },
      'garbage',
      { question: 'no id' },
    ]);
    expect(related).toHaveLength(4);
    expect(related[0]).toEqual({ id: '1', question: 'One?', topic: 'account' });
    // Full answer DTO caps related at 3 even if server sends more
    const out = sanitizeCampusAnswer({ matched: false, confidence: 0, query: 'q', related, disclaimer: '' });
    expect(out!.related).toHaveLength(3);
  });

  it('sanitizes the question list and drops malformed rows', () => {
    const out = sanitizeCampusQuestions([
      { id: 'verify-student', question: 'How do I get verified as an RGIT student?', topic: 'account', source: 'docs/SECURITY.md', pii: 'student@example.com' },
      { id: 'no-question' },
      null,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: 'verify-student',
      question: 'How do I get verified as an RGIT student?',
      topic: 'account',
      source: 'docs/SECURITY.md',
    });
    expect(JSON.stringify(out)).not.toContain('student@example.com');
    expect(sanitizeCampusQuestions(undefined)).toEqual([]);
    expect(sanitizeCampusQuestions({ data: [] })).toEqual([]);
  });
});
