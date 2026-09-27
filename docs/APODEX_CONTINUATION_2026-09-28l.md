# APODEX continuation (l): trustworthy weekly Q&A evidence

Base: `fb6d96c` (PR #14). Scope follows the supplied continuation-k report's explicit next step: weekly answered-question rate plus reopened-gap counts. The original ZIP was not attached to this continuation; this implementation uses the supplied report and existing repository research/continuation documents, not an invented ZIP review.

## Implemented
- Additive `campus_qa_daily_metrics` table: UTC date, answered, unanswered, reopened. No query text, user, session, IP or third-party processor. Atomic upserts avoid lost increments.
- Admin-only `GET /api/admin/campus-qa/metrics?weeks=8`, range 1–12, private/no-store, database failures surfaced rather than reported as zero.
- Monday-based weighted weekly rates, explicit numerator/denominator, null for no observations, current-week partial label, no fabricated historical backfill.
- Admin Demand Gaps tab: responsive CSS chart, accessible exact-value table, loading/empty/error/retry states, stale-snapshot warning and methodology. Validated response contract rejects contradictory denominators.
- Automatic reopened counts represent resolved-to-open transitions from unmatched queries, not every repeat or manual withdrawal. Lock gap via upsert, conditionally reopen, increment in the same transaction. Real PostgreSQL concurrency test verifies one transition for ten simultaneous refusals.
- Public answer responses now private/no-store. Cached responses previously hid requests from server demand measurement and delayed answer withdrawal. Public suggestion list remains cacheable. Outcome and gap writes are awaited and contain failures; measurement is still best-effort, not exactly-once.
- CI integration command now includes real PostgreSQL metrics tests; privacy/retention docs distinguish aggregate counters from existing gap text.

## Validation
- Server unit/contract suite: 172 passed; 11 optional DB tests skipped in the no-DB run and passed separately. New metrics unit tests: 6; existing gap suite adds 2.
- Frontend final full suite: 581 passed in 28 files, including 5 component tests (loading, values, empty, failure/retry, malformed payload).
- Real PostgreSQL 16.4: all 8 migrations replayed from empty DB; 11/11 integration tests passed, including 4 new tests for concurrent counters/reopening, admin access and live route writes.
- Backend production build/typecheck and frontend app-project typecheck: exit 0. Vite production build passed (existing large chunk warning). Targeted frontend ESLint passed.
- No live production deployment or student traction verified. Check PR CI before merge.

## Review council (one agent, explicit perspectives)
No independent multi-agent facility was available. Parallel installs/build/test jobs are not AI agents.
- Product: measure the answer-gap-review loop before expanding features; a matched answer is not proof it helped.
- Measurement: requests are the denominator, not students; retries/bots can inflate counts. Weight by counts, never average daily percentages.
- Privacy: no identifiers or question text added to metrics. Existing query URL/access logging needs a separate privacy review.
- Reliability: transactionally couple automatic reopening and its counter; add a real concurrency regression. DB trouble can lose telemetry and add latency; counters are best effort.
- Growth: weekly review the most frequent gaps, publish sourced answers, audit 20 matched answers manually and compare complete weeks. Target selection requires pilot evidence, not a “100x” promise.

## Premortem / launch gates
| Failure | Guard shipped | Remaining gate |
|---|---|---|
| Rate looks high because cache hides repeated misses | Answer endpoint no-store; visible definition | CDN bypass verification and rate-limit/load test |
| No traffic appears as perfect or 0% performance | Null/no observations and no backfill | Alert on missing ingestion and correlate API volume |
| Ten concurrent misses inflate reopened count | Gap row lock + conditional update + transactional counter | Multi-instance load test |
| Bot/retry traffic is presented as adoption | Explicit request-based labels | Verified pilot cohort and qualitative usefulness review |
| Missing DB migration looks like zero adoption | Admin read fails visibly; public writes degrade safely | Migration before deploy; rollback drill |
| Aggregate chart hides bad answers | Matched != helpful caveat | Weekly manual answer/source quality sampling |
| Shared daily row becomes contention hotspot | Existing public rate limits; atomic increments | Realistic traffic/latency test; consider per-instance buckets if warranted |

## Deployment / rollback
1. Rotate the GitHub token pasted into chat; do not store it in repo, logs or deployment config.
2. Back up production DB. In `server`, run `npx prisma migrate deploy`, then `npx prisma generate`; deploy tested commit.
3. Log in as admin → Demand Gaps → Weekly Q&A evidence. Ask one known and one unmatched question. Refresh metrics: total +2 and one increment in each outcome. Resolve a gap, cause an unmatched query for it, confirm only one reopen until next resolution.
4. Check anonymous access returns 401, student access 403, malformed week windows 400. Confirm response no-store through actual CDN/proxy.
5. Roll back application to prior tested commit if needed; leave additive metrics table in place. Do not drop stored evidence as a rollback shortcut.

## Still not production certification
Existing dependency audit: frontend 22 findings (1 critical, 11 high); server 22 (1 critical, 15 high), including critical Vitest development-tool advisory. Do not expose test/dev servers. Upgrade/triage in a separate validated change; do not run blind `audit fix --force`. DNS/hosting/secrets, live email/OAuth, backup restore, observability, realistic load, security/privacy audit and campus pilot remain release gates.

Next highest-priority increment: remediate dependency advisories with lockfile updates and regression tests, then add a corpus withdrawal/cache regression and independent reviewed-answer usefulness audit for the pilot.
