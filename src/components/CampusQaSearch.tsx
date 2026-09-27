/**
 * CampusQaSearch — landing-page search box in front of the public campus Q&A API.
 *
 * Anonymous-safe: reads only the reviewed, deterministic Q&A corpus via
 * /api/public/campus-qa. Shows the verbatim reviewed answer with its source
 * citation, an honest "no reviewed answer yet" state for unmatched queries,
 * related questions, and the safety disclaimer. Renders nothing on API
 * failure — a broken search must never fake an answer.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askCampusQuestion, type CampusAnswer, MAX_QA_QUERY_LENGTH } from '@/lib/campus-qa';

type Status = 'idle' | 'loading' | 'done' | 'error';

export function CampusQaSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<CampusAnswer | null>(null);
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce live answers as the user types; abort superseded requests so a
  // slow earlier response can never overwrite a newer one.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      abortRef.current?.abort();
      setStatus('idle');
      setResult(null);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setStatus('loading');
      askCampusQuestion(q, ctrl.signal)
        .then((answer) => {
          if (requestSeq.current !== seq) return;
          setResult(answer);
          setStatus('done');
        })
        .catch(() => {
          if (requestSeq.current !== seq) return;
          if (ctrl.signal.aborted) return;
          setStatus('error');
          setResult(null);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const askRelated = (question: string) => setQuery(question);

  return (
    <section
      aria-label="Ask about campus"
      data-testid="campus-qa-search"
      className="relative z-30 mt-6 w-full max-w-xl px-6 pointer-events-auto"
    >
      <label htmlFor="campus-qa-input" className="sr-only">
        Ask a question about RGIT Rozgar
      </label>
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 focus-within:border-white/30 transition-colors">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-white/40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="campus-qa-input"
          type="search"
          value={query}
          maxLength={MAX_QA_QUERY_LENGTH}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything — verification, safety, exchanges…"
          autoComplete="off"
          className="w-full bg-transparent text-sm text-white/85 placeholder:text-white/30 outline-none font-body"
        />
        {status === 'loading' && (
          <span
            aria-label="Searching"
            className="h-3 w-3 shrink-0 animate-spin rounded-full border border-white/20 border-t-white/70"
          />
        )}
      </div>

      {status === 'done' && result && (
        <div className="mt-3 rounded-md border border-white/10 bg-black/60 p-4 text-left backdrop-blur-sm">
          {result.matched && result.answer ? (
            <>
              <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-emerald-400/80">
                Reviewed answer{result.entry ? ` · ${result.entry.topic}` : ''}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/85 font-body">{result.answer}</p>
              {result.entry && (
                <p className="mt-2 text-[10px] font-mono text-white/35">
                  Source: {result.entry.source}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-white/70 font-body">
              No reviewed answer for that yet — the corpus is deliberately small and human-reviewed.
              Try one of the questions below, or{' '}
              <Link to="/help" className="underline underline-offset-2 hover:text-white">
                browse the help desk
              </Link>
              .
            </p>
          )}
          {result.related.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {result.related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => askRelated(r.question)}
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/60 transition-colors hover:border-white/30 hover:text-white"
                >
                  {r.question}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-white/30 font-body">{result.disclaimer}</p>
        </div>
      )}

      {status === 'error' && (
        <p className="mt-2 text-[11px] font-mono text-white/35">
          Search is unavailable right now — please try again in a moment.
        </p>
      )}
    </section>
  );
}

export default CampusQaSearch;
