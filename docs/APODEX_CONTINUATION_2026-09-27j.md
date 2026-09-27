# APODEX Continuation (j) - Admin Q&A Demand-Gap Console

Base on arrival: `main@192416b` (PR #11 merged). Research inputs: `APODEX_CONTINUATION_2026-09-27h.md`, `apodex-continuation-h-summary.md`, `apodex-continuation-i-report.md`, `RGIT_ROZGAR_APODEX_H_STATUS.md` (the referenced deliverables zip is again not present; the in-repo `docs/APODEX_CONTINUATION_*` chain is authoritative).

## 1. Gap found
Continuation (i) closed the *data* side of the corpus feedback loop (`campus_qa_gaps` + `GET /api/admin/campus-qa/gaps`) but left owner action #4 - "seed the reviewed corpus weekly from the gaps endpoint" - with **no UI**. An admin had to hit a raw JSON API with a bearer token. In a pilot that means the loop silently never runs.

## 2. Shipped
1. `src/lib/campus-qa-gaps.ts` - admin client helpers: limit clamped to the server range (1..100), whitelisted DTO (`queryText`, `hits`, `lastSeenAt` only - any extra field a server regression leaks is dropped), malformed rows dropped, row cap 200, sort by demand; RFC-4180 CSV export with **formula-injection neutralisation** (`= + - @ TAB CR` prefixed with `'`) because the worksheet is opened in Excel/Sheets; top-N demand-coverage metric.
2. `src/components/AdminCampusQaGaps.tsx` - admin panel: KPI tiles (open gaps, unanswered asks, top-10 share of demand), ranked table, Refresh, **Export review CSV** (columns `rank, query, hits, last_seen_at, proposed_answer, source_citation` - the reviewer fills the last two and the row becomes a corpus entry). Honest loading / error / empty states.
3. `src/pages/AdminPage.tsx` + `src/lib/admin-console.ts` - new sidebar tab **Q&A Demand Gaps** (`qa-gaps`), behind the existing admin route guard; server endpoint remains ADMIN-only + `no-store`.
4. `src/test/lib/campus-qa-gaps.test.ts` - 7 tests (limit clamping, field whitelist / PII-field drop, non-array + row cap, CSV injection, worksheet shape, coverage math, tab wiring contract).

No schema change, no migration, no new dependency, no public surface change.

## 3. Council (growth / privacy / security / ops / product)
- Growth: the fastest lever on answer-rate is closing the top gaps; top-10 share tells the reviewer how much demand one hour of writing removes.
- Privacy: the panel can only show what the server stored (normalised text, no identity); the client whitelist is a second fence.
- Security: CSV exports of user-typed text are a classic injection vector - neutralised and tested.
- Ops: zero backend change keeps deploy risk at nil; the tab is lazy with the admin page.
- Product: the CSV worksheet is the weekly ritual artefact - it turns a JSON endpoint into a 30-minute Monday task.

## 4. Premortem
| Failure mode | Fix in code |
|---|---|
| Loop never runs because nobody calls a raw API | Admin tab + one-click worksheet |
| Malicious query `=HYPERLINK(...)` executes in reviewer spreadsheet | `csvCell` prefixes formula chars; tested |
| Server regression adds userId/IP to gap rows | Client DTO whitelist; tested |
| Huge payload freezes admin UI | Server limit clamp 100 + client row cap 200 |
| Endpoint down | Error state + Refresh, rest of console unaffected |

## 5. Validation
- New suite 7/7 green first run; full frontend Vitest **25 files, 566/566**; strict `tsc -p tsconfig.app.json --noEmit` exit 0; `vite build` green.
- CI re-validates on the PR (GitGuardian, build-and-test 20.x/22.x, exchange-evidence-integration).

## 6. Open owner actions (real, unchanged)
1. ROTATE THE GITHUB PAT - it has appeared in plaintext across 10+ prompts; treat as burned.
2. DNS + hosting for `rgitrozgar.in`; set `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`, `DEPLOY_ENV_FILE`; watch the first real deploy.
3. Run the campus pilot with pre-agreed metrics (answer-rate, weekly gaps closed) before any traction claim. No traction is claimed here.
4. Next increment: admin "promote gap to reviewed entry" write path (DB-backed corpus) so the CSV step disappears.
