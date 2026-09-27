import { AdminCampusQaMetrics } from '@/components/AdminCampusQaMetrics';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { type ApiResponse } from '@/lib/api-client';
import {
  buildCampusQaGapsPath,
  campusQaGapsToCsv,
  sanitizeCampusQaGaps,
  topGapCoverage,
} from '@/lib/campus-qa-gaps';
import { Button } from '@/components/ui/button';
import { draftFromGap, type ReviewedAnswerDraft } from '@/lib/campus-qa-answers';
import { AdminCampusQaAnswerForm, AdminCampusQaReviewedAnswers } from '@/components/AdminCampusQaAnswerStudio';

/**
 * Admin panel: Campus Q&A demand gaps (APODEX continuation j).
 * Shows the questions students asked that the reviewed corpus could not answer,
 * ranked by demand, and exports a CSV worksheet for the weekly corpus review.
 * Data is aggregate-only (no user id / IP / session) by server construction.
 */
export function AdminCampusQaGaps() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'campus-qa', 'gaps'],
    queryFn: ({ signal }) => api.get<ApiResponse<unknown>>(buildCampusQaGapsPath(100), { signal }),
    staleTime: 60_000,
  });

  const rows = useMemo(() => sanitizeCampusQaGaps(data?.data), [data]);
  const [draft, setDraft] = useState<ReviewedAnswerDraft | null>(null);
  const totalHits = useMemo(() => rows.reduce((s, r) => s + r.hits, 0), [rows]);
  const coverage = useMemo(() => Math.round(topGapCoverage(rows, 10) * 100), [rows]);

  const exportCsv = () => {
    const blob = new Blob([campusQaGapsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-qa-gaps-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="admin-campus-qa-gaps">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-display font-bold uppercase tracking-widest border-l-2 border-primary pl-4">
          Q&amp;A Demand Gaps
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="rounded-none text-[10px] uppercase tracking-widest font-bold"
          >
            {isFetching ? 'Refreshing' : 'Refresh'}
          </Button>
          <Button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded-none bg-primary text-black hover:bg-teal-400 font-bold uppercase text-[10px] tracking-widest"
          >
            Export review CSV
          </Button>
        </div>
      </div>

      <p className="text-xs text-white/50 max-w-2xl">
        Questions students asked that no reviewed answer covered. Aggregated with no user id, IP or session.
        Press Answer on a row to publish a cited answer straight into the live corpus; the gap closes and reopens automatically if students keep asking it unmatched.
      </p>

      <AdminCampusQaMetrics />

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-white/10 p-4"><div className="text-[10px] uppercase text-white/40">Open gaps</div><div className="text-2xl font-bold">{rows.length}</div></div>
        <div className="border border-white/10 p-4"><div className="text-[10px] uppercase text-white/40">Unanswered asks</div><div className="text-2xl font-bold">{totalHits}</div></div>
        <div className="border border-white/10 p-4"><div className="text-[10px] uppercase text-white/40">Top-10 share</div><div className="text-2xl font-bold">{coverage}%</div></div>
      </div>

      {draft ? (
        <AdminCampusQaAnswerForm key={draft.gapQuery ?? 'new'} initial={draft} onDone={() => setDraft(null)} />
      ) : (
        <Button variant="outline" onClick={() => setDraft(draftFromGap(''))} className="rounded-none text-[10px] uppercase tracking-widest font-bold">
          New reviewed answer
        </Button>
      )}

      {isLoading ? (
        <p className="text-sm text-white/50">Loading demand gaps...</p>
      ) : isError ? (
        <p className="text-sm text-red-400" role="alert">Could not load demand gaps. Try Refresh.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/50">No unanswered questions recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-white/40 border-b border-white/10">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Question</th>
              <th className="py-2 pr-4">Asks</th>
              <th className="py-2 pr-4">Last seen</th>
              <th className="py-2"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.queryText}-${i}`} className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-white/40">{i + 1}</td>
                <td className="py-2 pr-4 text-white">{r.queryText}</td>
                <td className="py-2 pr-4 font-mono">{r.hits}</td>
                <td className="py-2 pr-4 font-mono text-xs text-white/50">{r.lastSeenAt ? r.lastSeenAt.slice(0, 10) : '--'}</td>
                <td className="py-2">
                  <Button variant="outline" onClick={() => setDraft(draftFromGap(r.queryText))} className="rounded-none text-[10px] uppercase tracking-widest font-bold h-7 px-3" aria-label={`Answer: ${r.queryText}`}>
                    Answer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AdminCampusQaReviewedAnswers />
    </div>
  );
}

export default AdminCampusQaGaps;
