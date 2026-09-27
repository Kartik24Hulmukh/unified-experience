/**
 * Admin client helpers for the Campus Q&A demand-gap queue (APODEX continuation j).
 *
 * The server aggregates honest refusals (matched:false) into `campus_qa_gaps`
 * with no user id / IP / session. This module re-shapes that admin payload into a
 * whitelisted DTO and exports it as a CSV that is safe to open in a spreadsheet
 * (formula-injection neutralised), so reviewers can seed the corpus weekly.
 */

export interface CampusQaGapRow {
  queryText: string;
  hits: number;
  lastSeenAt: string | null;
}

export const MAX_GAP_ROWS = 200;
const MAX_QUERY_TEXT = 200;

export function buildCampusQaGapsPath(limit = 50): string {
  const n = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 50;
  return `/admin/campus-qa/gaps?limit=${n}`;
}

function toIso(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Whitelist + clamp every row; drop anything malformed. Never throws. */
export function sanitizeCampusQaGaps(payload: unknown): CampusQaGapRow[] {
  if (!Array.isArray(payload)) return [];
  const rows: CampusQaGapRow[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.queryText !== 'string') continue;
    const queryText = rec.queryText.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_TEXT);
    if (!queryText) continue;
    const hitsRaw = typeof rec.hits === 'number' && Number.isFinite(rec.hits) ? Math.trunc(rec.hits) : 0;
    rows.push({ queryText, hits: Math.max(hitsRaw, 0), lastSeenAt: toIso(rec.lastSeenAt) });
    if (rows.length >= MAX_GAP_ROWS) break;
  }
  return rows.sort((a, b) => b.hits - a.hits);
}

/** Neutralise spreadsheet formula injection and quote per RFC 4180. */
export function csvCell(value: string | number | null): string {
  let s = value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function campusQaGapsToCsv(rows: CampusQaGapRow[]): string {
  const header = ['rank', 'query', 'hits', 'last_seen_at', 'proposed_answer', 'source_citation'];
  const lines = rows.map((r, i) =>
    [csvCell(i + 1), csvCell(r.queryText), csvCell(r.hits), csvCell(r.lastSeenAt), csvCell(''), csvCell('')].join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

/** Share of total unmatched demand covered by the top N gaps (0..1). */
export function topGapCoverage(rows: CampusQaGapRow[], n = 10): number {
  const total = rows.reduce((s, r) => s + r.hits, 0);
  if (total <= 0) return 0;
  const top = rows.slice(0, n).reduce((s, r) => s + r.hits, 0);
  return Math.min(top / total, 1);
}
