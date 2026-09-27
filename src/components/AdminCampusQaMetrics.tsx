import { useQuery } from '@tanstack/react-query';
import api, { type ApiResponse } from '@/lib/api-client';
import { CAMPUS_QA_METRICS_PATH, formatAnswerRate, parseCampusQaMetrics } from '@/lib/campus-qa-metrics';
import { Button } from '@/components/ui/button';

/** An accessible CSS bar chart with the exact numerator/denominator in a table. */
export function AdminCampusQaMetrics() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'campus-qa', 'metrics'],
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiResponse<unknown>>(CAMPUS_QA_METRICS_PATH, { signal });
      return parseCampusQaMetrics(response.data);
    },
    staleTime: 60_000,
  });
  return <section aria-labelledby="qa-evidence-title" className="border border-white/15 p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 id="qa-evidence-title" className="text-sm font-bold uppercase tracking-widest">Weekly Q&amp;A evidence</h4>
      <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
        {isFetching ? 'Refreshing metrics' : 'Refresh metrics'}
      </Button>
    </div>
    <p className="text-xs text-white/60">Reviewed-answer matches, not proof of helpfulness or unique students. Monday–Sunday, UTC. Current week is partial.</p>
    {isLoading && <p role="status">Loading weekly evidence…</p>}
    {isError && <p role="alert" className="text-sm text-red-400">Weekly evidence could not be loaded. Retry with Refresh metrics; missing data is not zero activity.</p>}
    {data && <>
      {isError && <p className="text-xs text-amber-300">Showing the last successful snapshot.</p>}
      {!data.weeks.some(w => w.total > 0) && <p className="text-sm text-white/60">No recorded questions in this window. Collection starts after the metrics migration; older traffic cannot be reconstructed.</p>}
      <div className="space-y-2" role="img" aria-label="Weekly answered-question rate chart. Exact values and reopened transitions are in the following table.">
        {data.weeks.map(w => <div key={w.weekStart} className="flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0">{w.weekStart}{w.partial ? ' *' : ''}</span>
          <div className="h-3 flex-1 bg-white/10 overflow-hidden" aria-hidden="true">
            {w.answerRate !== null && <div className="h-full bg-primary" style={{ width: `${w.answerRate * 100}%` }} />}
          </div>
          <span className="w-28 text-right">{formatAnswerRate(w.answerRate)}</span>
        </div>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <caption className="text-left text-white/60 pb-2">Observed requests and automatic resolved-to-open gap transitions</caption>
          <thead><tr>{['Week of (UTC)', 'Answered', 'Unanswered', 'Total', 'Answer rate', 'Reopened'].map(h => <th key={h} scope="col" className="p-2 border-b border-white/15">{h}</th>)}</tr></thead>
          <tbody>{data.weeks.map(w => <tr key={w.weekStart}>
            <th scope="row" className="p-2 font-normal whitespace-nowrap">{w.weekStart}{w.partial ? ' (partial)' : ''}</th>
            <td className="p-2">{w.answered}</td><td className="p-2">{w.unanswered}</td><td className="p-2">{w.total}</td>
            <td className="p-2 whitespace-nowrap">{formatAnswerRate(w.answerRate)}</td><td className="p-2">{w.reopened}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <details className="text-xs text-white/60"><summary className="cursor-pointer">How to interpret this evidence</summary>
        <p className="mt-2">{data.methodology}</p>
        <p className="mt-2">Snapshot: {data.until}. Observed days do not guarantee complete collection. Manual answer withdrawal is excluded from reopened counts. Audit a sample of matched answers before treating a rising rate as student value.</p>
      </details>
    </>}
  </section>;
}
