import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  buildCampusQaGapsPath,
  campusQaGapsToCsv,
  csvCell,
  MAX_GAP_ROWS,
  sanitizeCampusQaGaps,
  topGapCoverage,
} from '@/lib/campus-qa-gaps';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('campus-qa-gaps admin client', () => {
  it('clamps the limit into the server-accepted range', () => {
    expect(buildCampusQaGapsPath()).toBe('/admin/campus-qa/gaps?limit=50');
    expect(buildCampusQaGapsPath(0)).toBe('/admin/campus-qa/gaps?limit=1');
    expect(buildCampusQaGapsPath(10_000)).toBe('/admin/campus-qa/gaps?limit=100');
    expect(buildCampusQaGapsPath(Number.NaN)).toBe('/admin/campus-qa/gaps?limit=50');
  });

  it('whitelists fields, drops malformed rows and sorts by demand', () => {
    const rows = sanitizeCampusQaGaps([
      { queryText: '  mess   timings sunday ', hits: 3, lastSeenAt: '2026-09-27T10:00:00.000Z', userId: 'u1', ip: '1.2.3.4' },
      { queryText: 'library hours exam week', hits: 9, lastSeenAt: 'not-a-date' },
      { queryText: 42, hits: 1 },
      null,
      ['array'],
      { queryText: '   ', hits: 5 },
      { queryText: 'bus pass renewal', hits: -4 },
    ]);
    expect(rows).toEqual([
      { queryText: 'library hours exam week', hits: 9, lastSeenAt: null },
      { queryText: 'mess timings sunday', hits: 3, lastSeenAt: '2026-09-27T10:00:00.000Z' },
      { queryText: 'bus pass renewal', hits: 0, lastSeenAt: null },
    ]);
    expect(Object.keys(rows[1])).toEqual(['queryText', 'hits', 'lastSeenAt']);
  });

  it('rejects non-array payloads and caps row count', () => {
    expect(sanitizeCampusQaGaps({ queryText: 'x y', hits: 1 })).toEqual([]);
    expect(sanitizeCampusQaGaps(undefined)).toEqual([]);
    const many = Array.from({ length: MAX_GAP_ROWS + 50 }, (_, i) => ({ queryText: `q ${i}`, hits: i }));
    expect(sanitizeCampusQaGaps(many)).toHaveLength(MAX_GAP_ROWS);
  });

  it('neutralises spreadsheet formula injection in CSV cells', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1')).toBe(`"'+1"`);
    expect(csvCell('-cmd')).toBe(`"'-cmd"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('hostel wifi')).toBe('"hostel wifi"');
    expect(csvCell(null)).toBe('""');
  });

  it('exports a review worksheet with answer + citation columns', () => {
    const csv = campusQaGapsToCsv([{ queryText: 'mess timings, sunday', hits: 3, lastSeenAt: null }]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('rank,query,hits,last_seen_at,proposed_answer,source_citation');
    expect(lines[1]).toBe('"1","mess timings, sunday","3","","",""');
  });

  it('computes top-N demand coverage safely', () => {
    expect(topGapCoverage([])).toBe(0);
    const rows = [10, 5, 5].map((hits, i) => ({ queryText: `q ${i}`, hits, lastSeenAt: null }));
    expect(topGapCoverage(rows, 1)).toBe(0.5);
    expect(topGapCoverage(rows, 10)).toBe(1);
  });

  it('admin console exposes the Q&A Demand Gaps tab', () => {
    const page = readFileSync(path.join(ROOT, 'src/pages/AdminPage.tsx'), 'utf8');
    expect(page).toContain("id: 'qa-gaps'");
    expect(page).toContain("activeTab === 'qa-gaps' && <AdminCampusQaGaps />");
    const consoleLib = readFileSync(path.join(ROOT, 'src/lib/admin-console.ts'), 'utf8');
    expect(consoleLib).toContain("'qa-gaps'");
  });
});
