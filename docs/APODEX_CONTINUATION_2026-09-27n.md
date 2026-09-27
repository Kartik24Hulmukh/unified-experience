# APODEX continuation (n): corpus withdrawal / cache regression

Date: 2026-09-27. Base: `b9d808d` (merge of PR #16).

## Why this increment

Continuation (m) named this the next job, ahead of dev-tool upgrades: **a
withdrawn answer must never be served again - not by the API, not by a
browser/CDN cache, not by client memory.** Before this change there were two
real defects:

1. `GET /api/public/campus-qa/questions` was cached `public, max-age=600,
   stale-while-revalidate=3600`. After an admin unpublished a DB-reviewed
   answer, shared caches could keep advertising the withdrawn question for
   up to an hour, and would still serve it under `stale-while-revalidate`
   long after.
2. `HelpPage` kept fetched answers in component state and skipped refetch
   (`if (answers[q.id]) return`). A withdrawn answer stayed on screen for
   the rest of the session even though the answer API is `no-store`, and a
   refetch after withdrawal would still have rendered the stale paragraph
   because a fetched answer was only *added*, never cleared.

## Changes

| Area | Change |
|---|---|
| `server/src/routes/public.ts` | Questions list cache shortened to `public, max-age=30, stale-while-revalidate=30` - strictly shorter than the 60s corpus refresh TTL, so withdrawal propagates to shared caches within seconds. The answer endpoint keeps `private, no-store` (PR #15). |
| `src/pages/HelpPage.tsx` | In-memory answers are no longer treated as durable: every expand re-asks the live answer API; while refetching, the stale paragraph is hidden; a `matched: false` response (withdrawal) replaces the stale answer with the unavailable hint instead of leaving the old text. |
| `server/tests/campus-qa-corpus.test.ts` | New `withdrawal regression` suite: publish -> public serve -> unpublish -> questions list omits the slug -> answer endpoint refuses (`matched:false`, null answer/entry) -> linked gaps reopen. Plus Cache-Control contract tests pinning `no-store` on answers and the short TTL on the questions list. |
| `src/test/pages/help-page-withdrawal.test.tsx` | New UI regression: expand shows the reviewed answer; collapse; admin unpublishes; re-expand re-asks the API and the withdrawn paragraph disappears; pending state masks the stale copy during refetch. |

## What did NOT change (deliberately)

- The corpus merge contract (static ids win collisions, TTL refresh, never
  throw on DB outage) is untouched.
- No analytics or gap-counting changes; privacy posture of PR #15 stands.
- `/api/public/listings` caching is unchanged - listings are a different
  trust domain (no withdrawal path exists there).

## Validation

- Frontend vitest: full suite (incl. the 2 new HelpPage regression tests).
- Frontend `tsc -p tsconfig.app.json` and `vite build`.
- Server vitest: full suite (incl. the 3 new withdrawal contract tests).
- Server `tsc --noEmit`.

## Remaining limits (honest)

- Other browser tabs open before withdrawal are not live-invalidated; they
  refresh on next navigation within the short cache window. A corpus-revision
  ETag would close even this; left as a future refinement.
- Multi-instance deploys still converge within the 60s corpus TTL; the
  question cache (30s) can never outlive it.
- Production hosting, DNS, token rotation and the campus pilot remain owner
  operations outside this sandbox.
