/**
 * HelpPage — public, indexable campus help desk (APODEX campus Q&A, frontend).
 *
 * Renders the full reviewed question set grouped by topic; expanding a
 * question asks the deterministic Q&A API and shows the verbatim reviewed
 * answer with its source citation. Public route — no auth, no student data,
 * every answer traceable to a reviewed in-repo document.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, ChevronDown, LifeBuoy } from 'lucide-react';
import {
  askCampusQuestion,
  fetchCampusQuestions,
  type CampusAnswer,
  type CampusQuestion,
} from '@/lib/campus-qa';

const TOPIC_LABELS: Record<string, string> = {
  account: 'Account & verification',
  exchange: 'Exchanges',
  safety: 'Safety',
  privacy: 'Privacy',
  directory: 'Directories',
  support: 'Support & reports',
};

const TOPIC_ORDER = ['account', 'exchange', 'safety', 'privacy', 'directory', 'support'];

export default function HelpPage() {
  const [questions, setQuestions] = useState<CampusQuestion[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, CampusAnswer>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchCampusQuestions(ctrl.signal)
      .then(setQuestions)
      .catch(() => setLoadFailed(true));
    return () => ctrl.abort();
  }, []);

  const grouped = useMemo(() => {
    const byTopic = new Map<string, CampusQuestion[]>();
    for (const q of questions ?? []) {
      const list = byTopic.get(q.topic) ?? [];
      list.push(q);
      byTopic.set(q.topic, list);
    }
    const ordered = TOPIC_ORDER.filter((t) => byTopic.has(t)).map(
      (t) => [TOPIC_LABELS[t] ?? t, byTopic.get(t)!] as const,
    );
    for (const [topic, list] of byTopic) {
      if (!TOPIC_ORDER.includes(topic)) ordered.push([TOPIC_LABELS[topic] ?? topic, list]);
    }
    return ordered;
  }, [questions]);

  const toggle = async (q: CampusQuestion) => {
    if (openId === q.id) {
      setOpenId(null);
      return;
    }
    setOpenId(q.id);
    setPendingId(q.id);
    try {
      // Always re-ask the live (no-store) answer API. In-memory answers are
      // never treated as durable: if an admin withdraws an answer mid-session,
      // matched:false replaces the stale paragraph instead of keeping it.
      const answer = await askCampusQuestion(q.question);
      setAnswers((prev) => ({ ...prev, [q.id]: answer }));
    } catch {
      // Leave the answer absent; the row shows a retry hint.
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Campus Help Desk — BErozgar</title>
        <meta
          name="description"
          content="Reviewed answers about RGIT Rozgar: student verification, safe exchanges, resale, accommodation, mess and hospital directories. Every answer cites its reviewed source document."
        />
      </Helmet>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-foreground/50 hover:text-foreground transition-colors mb-12 tap-target"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <LifeBuoy className="w-6 h-6 text-primary" />
          <span className="text-xs font-mono uppercase tracking-widest text-foreground/40">
            Reviewed answers only
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold uppercase tracking-tight mb-4">
          Campus Help Desk
        </h1>
        <p className="text-foreground/50 text-sm leading-relaxed max-w-xl mb-12">
          Every answer below comes verbatim from a human-reviewed RGIT Rozgar document and cites
          its source — no generated guesses, no student data. For medical emergencies call 108 or
          112. Never share OTPs, UPI PINs or bank credentials with anyone.
        </p>

        {loadFailed && (
          <p className="text-sm text-foreground/50 font-mono">
            The help desk is unavailable right now — please try again in a moment.
          </p>
        )}
        {!loadFailed && questions === null && (
          <p className="text-sm text-foreground/40 font-mono animate-pulse">Loading reviewed questions…</p>
        )}

        {grouped.map(([label, list]) => (
          <section key={label} className="mb-10">
            <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-foreground/40 mb-3">
              {label}
            </h2>
            <ul className="divide-y divide-foreground/10 border-y border-foreground/10">
              {list.map((q) => {
                const open = openId === q.id;
                const answer = answers[q.id];
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => toggle(q)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm md:text-base text-foreground/80 hover:text-foreground transition-colors"
                    >
                      <span>{q.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>
                    {open && (
                      <div className="pb-5 pl-1">
                        {pendingId === q.id ? (
                          <p className="text-sm text-foreground/40 animate-pulse">Fetching reviewed answer…</p>
                        ) : answer?.matched && answer.answer ? (
                          <>
                            <p className="text-sm leading-relaxed text-foreground/70">{answer.answer}</p>
                            <p className="mt-2 text-[11px] font-mono text-foreground/35">
                              Source: {answer.entry?.source ?? q.source}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-foreground/40">
                            Answer unavailable right now — please retry.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="mt-16 flex flex-wrap gap-x-6 gap-y-2 text-xs font-mono uppercase tracking-widest text-foreground/35">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/signup" className="hover:text-foreground transition-colors">Get verified</Link>
        </div>
      </div>
    </div>
  );
}
