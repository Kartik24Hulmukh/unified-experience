import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCampusQaGapsPath } from '@/lib/campus-qa-gaps';
import {
  draftFromGap,
  isValidSource,
  parseKeywords,
  sanitizeReviewedAnswers,
  toCreatePayload,
  validateDraft,
} from '@/lib/campus-qa-answers';

const good = {
  gapQuery: 'photocopy xerox printout shop timings',
  question: 'Where can I get photocopies near RGIT?',
  answer: 'The xerox counter is at the stationery shop by the main gate, open 9am to 7pm on working days.',
  topic: 'directory' as const,
  source: 'docs/CAMPUS_GUIDE.md',
  keywords: 'Xerox, printout, xerox, a',
};

describe('campus Q&A answer composer (APODEX k)', () => {
  it('prefills a tidy question from the gap text', () => {
    const d = draftFromGap('  where is   the xerox shop ');
    expect(d.question).toBe('Where is the xerox shop?');
    expect(d.gapQuery).toBe('where is the xerox shop');
  });

  it('accepts a clean cited draft and builds the server payload', () => {
    expect(validateDraft(good)).toEqual({});
    const p = toCreatePayload(good);
    expect(p.keywords).toEqual(['xerox', 'printout']);
    expect(p.gapQuery).toBe(good.gapQuery);
  });

  it('flags PII, missing citations and thin answers before sending', () => {
    expect(validateDraft({ ...good, answer: 'Mail the owner at owner@example.com for bulk prints please.' }).answer).toBeTruthy();
    expect(validateDraft({ ...good, source: 'my friend said so' }).source).toBeTruthy();
    expect(validateDraft({ ...good, answer: 'short' }).answer).toBeTruthy();
    expect(isValidSource('http://insecure.example')).toBe(false);
    expect(parseKeywords('a, bb, ' + 'x'.repeat(31))).toEqual(['bb']);
  });

  it('sanitizes admin answer rows', () => {
    const rows = sanitizeReviewedAnswers([{ id: '1', question: 'q', answer: 'a', published: true, ip: '1.2.3.4' }, { bad: true }, null]);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).not.toContain('ip');
  });

  it('requests a gaps limit the server accepts (regression: limit=100 used to 400)', () => {
    expect(buildCampusQaGapsPath(100)).toBe('/admin/campus-qa/gaps?limit=100');
    const admin = readFileSync(resolve(__dirname, '..', '..', '..', 'server', 'src', 'routes', 'admin.ts'), 'utf8');
    expect(admin).toMatch(/limit: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/);
    expect(admin).toContain("app.post('/campus-qa/answers'");
  });

  it('wires the composer into the gaps console', () => {
    const ui = readFileSync(resolve(__dirname, '..', '..', 'components', 'AdminCampusQaGaps.tsx'), 'utf8');
    expect(ui).toContain('AdminCampusQaAnswerForm');
    expect(ui).toContain('AdminCampusQaReviewedAnswers');
    expect(ui).toContain('draftFromGap(r.queryText)');
  });
});
