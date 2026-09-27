import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { type ApiResponse } from '@/lib/api-client';
import {
  CAMPUS_QA_ANSWERS_PATH,
  CAMPUS_QA_TOPICS,
  sanitizeReviewedAnswers,
  toCreatePayload,
  validateDraft,
  type CampusQaTopic,
  type ReviewedAnswerDraft,
} from '@/lib/campus-qa-answers';
import { Button } from '@/components/ui/button';

const field = 'w-full bg-black/40 border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary';
const label = 'block text-[10px] uppercase tracking-widest text-white/50 mb-1';

/**
 * Answer composer (APODEX continuation k): publish a cited answer for a demand
 * gap in one step. The server stores it, merges it into the deterministic Q&A
 * engine within a minute on every instance, and resolves the gap.
 */
export function AdminCampusQaAnswerForm({ initial, onDone }: { initial: ReviewedAnswerDraft; onDone: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ReviewedAnswerDraft>(initial);
  const [touched, setTouched] = useState(false);
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const hasErrors = Object.keys(errors).length > 0;

  const mutation = useMutation({
    mutationFn: () => api.post<ApiResponse<unknown>>(CAMPUS_QA_ANSWERS_PATH, toCreatePayload(draft)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'campus-qa'] });
      onDone();
    },
  });

  const set = <K extends keyof ReviewedAnswerDraft>(k: K, v: ReviewedAnswerDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!hasErrors) mutation.mutate();
  };
  const err = (k: keyof ReviewedAnswerDraft) =>
    touched && errors[k] ? <p className="text-xs text-red-400 mt-1" role="alert">{errors[k]}</p> : null;

  return (
    <form onSubmit={submit} className="border border-primary/40 p-4 space-y-3" data-testid="campus-qa-answer-form" aria-label="Publish reviewed answer">
      {draft.gapQuery ? (
        <p className="text-xs text-white/50">Answering student demand: <span className="text-white">"{draft.gapQuery}"</span></p>
      ) : null}
      <div>
        <label className={label} htmlFor="qa-question">Question</label>
        <input id="qa-question" className={field} value={draft.question} maxLength={200} onChange={(e) => set('question', e.target.value)} />
        {err('question')}
      </div>
      <div>
        <label className={label} htmlFor="qa-answer">Reviewed answer (plain text, no personal data)</label>
        <textarea id="qa-answer" className={`${field} min-h-[96px]`} value={draft.answer} maxLength={1200} onChange={(e) => set('answer', e.target.value)} />
        <div className="text-[10px] text-white/30 text-right">{draft.answer.length}/1200</div>
        {err('answer')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="qa-topic">Topic</label>
          <select id="qa-topic" className={field} value={draft.topic} onChange={(e) => set('topic', e.target.value as CampusQaTopic)}>
            {CAMPUS_QA_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="qa-source">Source citation</label>
          <input id="qa-source" className={field} placeholder="docs/CAMPUS_GUIDE.md or https://..." value={draft.source} onChange={(e) => set('source', e.target.value)} />
          {err('source')}
        </div>
        <div>
          <label className={label} htmlFor="qa-keywords">Extra keywords (comma separated)</label>
          <input id="qa-keywords" className={field} placeholder="xerox, printout" value={draft.keywords} onChange={(e) => set('keywords', e.target.value)} />
        </div>
      </div>
      {mutation.isError ? (
        <p className="text-xs text-red-400" role="alert">Publish failed: {(mutation.error as Error)?.message ?? 'server rejected the answer'}.</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending || (touched && hasErrors)} className="rounded-none bg-primary text-black hover:bg-teal-400 font-bold uppercase text-[10px] tracking-widest">
          {mutation.isPending ? 'Publishing' : 'Publish answer'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} className="rounded-none text-[10px] uppercase tracking-widest font-bold">Cancel</Button>
      </div>
    </form>
  );
}

/** Published / retired reviewed answers with a one-click publish toggle. */
export function AdminCampusQaReviewedAnswers() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'campus-qa', 'answers'],
    queryFn: ({ signal }) => api.get<ApiResponse<unknown>>(CAMPUS_QA_ANSWERS_PATH, { signal }),
    staleTime: 60_000,
  });
  const rows = useMemo(() => sanitizeReviewedAnswers(data?.data), [data]);
  const toggle = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.patch<ApiResponse<unknown>>(`${CAMPUS_QA_ANSWERS_PATH}/${encodeURIComponent(id)}`, { published }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'campus-qa'] }),
  });

  return (
    <section className="space-y-3" data-testid="campus-qa-reviewed-answers" aria-labelledby="qa-reviewed-heading">
      <h4 id="qa-reviewed-heading" className="text-sm font-bold uppercase tracking-widest text-white/70">Reviewed answers in the live corpus</h4>
      {isLoading ? (
        <p className="text-sm text-white/50">Loading reviewed answers...</p>
      ) : isError ? (
        <p className="text-sm text-red-400" role="alert">Could not load reviewed answers.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-white/50">No database answers yet. Answer a gap above to publish the first one.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border border-white/10 p-3 flex flex-wrap justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">{r.question}</div>
                <div className="text-xs text-white/40 truncate">{r.topic} · {r.source}</div>
              </div>
              <Button
                variant="outline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id: r.id, published: !r.published })}
                className="rounded-none text-[10px] uppercase tracking-widest font-bold"
              >
                {r.published ? 'Unpublish' : 'Republish'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
