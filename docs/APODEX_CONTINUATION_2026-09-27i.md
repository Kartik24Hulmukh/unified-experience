# APODEX Continuation (i) — SEO Surface Complete + Campus Q&A Demand-Gap Loop

**Date:** 27 September 2026
**Repository:** https://github.com/Kartik24Hulmukh/unified-experience
**Base:** `main@06a4605` (PR #10 merged)
**Deliverable Status:** Validated locally — frontend 24 files / 559 tests green, backend 21 files / 151 tests green, strict `tsc` exit 0, `vite build` green, server `npm run build` green.

---

## 1. Executive Summary

Continuation (h) shipped the anonymous, cited Campus Q&A frontend (landing search box + indexable `/help`) but ran out of budget with two items staged and unpushed, and with the corpus feedback loop still open. This session finished exactly that remaining work and closed the loop:

1. **Staged work recovered and completed (the h-session backlog):**
   - `public/sitemap.xml` now publishes `/help` (0.8, weekly), `/privacy` and `/terms` (0.4, monthly) alongside `/`, `/login`, `/signup` — crawlers can finally discover the help desk.
   - `src/test/routes/help-desk-route.test.ts` — 3 static contract tests: `/help` route + error boundary, landing-page `CampusQaSearch` mount, and sitemap/robots coverage of `/help`, `/privacy`, `/terms`. The one-character typo (`expoct`) from the h session was avoided by rewriting the assertions; the `/faq` + `/support` alias assertions caught a REAL gap (see #3).
2. **Real gap found and fixed by the new contract tests:** `App.tsx` only registered `/help`; the `/faq` and `/support` aliases documented in the h deliverable did not exist. Added `<Route path="/faq">` and `<Route path="/support">` as `<Navigate to="/help" replace />` so QR cards, word-of-mouth links and old bookmarks all land on the help desk instead of a 404.
3. **Campus Q&A demand-gap loop (new product increment):** honest refusals are now a growth signal.
   - `server/src/services/campusQaGapService.ts`: when `/api/public/campus-qa` returns `matched: false`, the query is normalized (lowercased, whitespace-collapsed, 200-char cap) and, if it contains NO PII-shaped token (email / phone / 12+ digit id run) and has ≥2 tokens, upserted into `campus_qa_gaps` keyed by sha256 hash with a `hits` counter. No user id, no IP, no session — a pure demand signal.
   - `server/prisma/schema.prisma` + migration `20260927210000_campus_qa_gaps`: `CampusQaGap` model (`query_hash` unique, `query_text` varchar(200), `hits`, `last_seen_at`, index on `hits`).
   - Wired fire-and-forget into the public route (`void recordUnmatchedQuery(q)` on refusal) — a logging failure can never degrade or delay the public answer.
   - `GET /api/admin/campus-qa/gaps?limit=N` (ADMIN-only, `no-store`) returns the top demand gaps — the exact queue of questions the reviewed corpus must grow into next.
4. **Tests:** `server/tests/campus-qa-gaps.test.ts` (7 tests) locks the privacy contract (PII dropped, thin queries dropped, answered queries never stored, storage failure swallowed) and the route wiring via `app.inject`.

No new dependency. No auth surface touched. Public endpoints unchanged in shape.

---

## 2. Council Meeting (parallel agents)

- **Growth Agent:** the corpus is static and reviewed, so it can only grow where students actually ask. Refusals were previously invisible; now each refusal increments a hashed, PII-free demand counter, and `/api/admin/campus-qa/gaps` is the prioritized corpus backlog. Traction becomes measurable instead of assumed.
- **Privacy Agent:** storing raw queries would be a PII magnet. Contract: unmatched-only, no identity fields at all, PII-shaped strings dropped (not redacted — dropping is stronger), 2-token minimum so "hi" noise never lands in the table, sha256 dedupe so one student spamming a question cannot inflate it beyond `hits`.
- **Reliability Agent:** gap logging is `void`-fire-and-forget with an internal try/catch returning `false`; the public 200 response and its Cache-Control headers are computed before any logging. DB down ≠ help desk down.
- **SEO Agent:** a help page nobody can crawl is dead weight. sitemap + robots assertions in a CI-run contract test mean a future regression that hides `/help` from crawlers fails the build, not production.
- **Ops Agent:** migration is additive-only (one CREATE TABLE + indexes), reversible with `DROP TABLE`, no lock risk on hot tables; `prisma migrate deploy` in the existing pipeline applies it.

## 3. Premortem — failure modes & fixes already in code

| Failure mode | Fix in code |
|---|---|
| PII smuggled into gap table via query text | `normalizeGapQuery` returns null on email/phone/long-digit regex hits; tests assert all three shapes are dropped |
| Gap logging outage breaks public Q&A | `recordUnmatchedQuery` try/catch → false; route calls it `void` after the reply payload is built; test injects a rejected upsert |
| Corpus backlog polluted by noise ("hi", single words) | ≥2 tokens of length >1 required; tested |
| One user inflating a gap | sha256 unique key + `hits` increment, not row-per-query; tested |
| `/faq` `/support` links 404 after QR-card campaign | alias routes added + contract test asserts them in App.tsx |
| `/help` silently removed from sitemap later | contract test reads sitemap.xml + robots.txt in CI |
| Migration drift (schema vs SQL) | hand-written SQL mirrors schema.prisma exactly; `prisma migrate deploy` is the only apply path |

## 4. Validation log

```
Frontend: npx vitest run            → 24 files, 559/559 passed, exit 0
Frontend: npx tsc -p tsconfig.app.json --noEmit → exit 0
Frontend: npm run build (vite)      → exit 0
Backend : npx vitest run            → 21 files passed (1 skipped), 151 passed (7 skipped), exit 0
Backend : npm run build             → tsc --noEmit + esbuild bundle, exit 0
New     : tests/campus-qa-gaps.test.ts → 7/7 passed (route wiring verified via app.inject)
```

## 5. Open owner actions (unchanged, real)

1. ROTATE THE GITHUB PAT — it has now appeared in plaintext across ≥9 task prompts. Treat as burned.
2. DNS + hosting for `rgitrozgar.in`; set `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`, `DEPLOY_ENV_FILE`; watch the first real deploy by hand.
3. Campus pilot with pre-agreed metrics before any traction claim. **No traction is claimed here.**
4. Seed the corpus from `/api/admin/campus-qa/gaps` weekly during the pilot.
