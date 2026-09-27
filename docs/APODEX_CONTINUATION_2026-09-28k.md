# APODEX Continuation (k) — One-click gap → reviewed answer (DB-backed corpus)

**Base:** `main@a53475f` (PR #13 merged). **Branch:** `apodex-qa-answer-studio`.

## Why this increment
Continuation (j) named the next build: *an admin button that turns a gap straight into a reviewed answer, with answers stored in the database, so the CSV step goes away.* Without it, closing a gap needed a code change, PR and redeploy for every answer — which will not happen weekly during a pilot.

## Critical bug found while validating (fixed here)
The (j) admin console requested `GET /api/admin/campus-qa/gaps?limit=100`, but the server capped `limit` at 50 and returned **400**. The Q&A Demand Gaps tab could never load in production. The server bound is now 1–100 and a regression test ties the client path to the server schema.

## Shipped
- **Schema + migration** `20260928090000_campus_qa_reviewed_answers`: new `campus_qa_answers` table (slug, question, answer, topic, keywords[], source, published, created_by_id); `campus_qa_gaps` gains `resolved_at` + `answer_id`. Additive only.
- **`campusQaCorpusService`**: zod-validated create (PII rejected, https or in-repo citation required, length caps), deterministic slug, keywords auto-derived from the student’s own phrasing so the gap itself matches, transactional create + gap resolution, publish/unpublish, never-throw TTL (60 s) refresh with single-flight so every instance converges within a minute.
- **Engine**: `setReviewedAnswers()` atomically rebuilds the IDF index over static + DB answers; static entries always win id collisions; `/campus-qa` and `/campus-qa/questions` include DB answers.
- **Self-healing queue**: resolved gaps are hidden from the queue; if a student asks the same thing again unmatched the gap **reopens**; unpublishing an answer reopens its linked gaps.
- **Admin API** (ADMIN-only, no-store): `GET/POST /api/admin/campus-qa/answers`, `PATCH /api/admin/campus-qa/answers/:id`.
- **Admin UI**: an *Answer* button on every gap row opens a composer prefilled from the gap (question, answer, topic, citation, extra keywords) with inline validation mirroring the server; a *Reviewed answers in the live corpus* list with Unpublish/Republish.

## Council / premortem
| Failure mode | Control |
|---|---|
| Admin publishes a phone number / email | Rejected client-side and server-side (same PII patterns as gap logging) |
| Uncited or hostile link as source | Only `docs/...` paths (no `..`) or https URLs without credentials |
| DB outage takes public Q&A down | Refresh never throws; last good corpus (static at minimum) keeps serving |
| Multi-instance drift after publish | 60 s TTL refresh on the public path, single-flight |
| DB answer hijacks a core safety answer | Static ids win collisions; core intents regression-tested |
| Published answer still does not match students’ phrasing | Gap tokens auto-added as keywords; a new unmatched hit reopens the gap |
| Bad answer goes live | One-click unpublish; linked demand returns to the queue |
| Admin tab silently broken | limit=100 contract regression test |

## Validation
- Server: `vitest run` 22 files, **164 passed** / 7 skipped (integration, DB-gated); new file 13/13. `tsc --noEmit` 0 errors; server bundle build OK.
- Frontend: **26 files, 572/572** (+6); `tsc -p tsconfig.app.json` 0 errors; `vite build` OK (existing chunk-size advisory only).

## Owner actions
1. Run `prisma migrate deploy` on the target DB (additive migration).
2. Rotate the GitHub PAT — it has been pasted in plain text repeatedly.
3. Decide on stale PR #12 (duplicate of merged #13).
4. DNS/VPS secrets and the first supervised deploy; campus pilot with pre-agreed metrics (gaps closed per week, matched-answer rate). No traction is claimed.
