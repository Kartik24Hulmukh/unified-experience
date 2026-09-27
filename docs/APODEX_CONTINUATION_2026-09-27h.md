# APODEX Continuation (h): RGIT Rozgar / unified-experience

**Date:** 27 Sep 2026 · **Repo:** https://github.com/Kartik24Hulmukh/unified-experience
**Start:** `main@cb40dc9` (PR #9 merged) → **End:** see merge commit of the PR from `apodex-campus-qa-frontend`

## Scope picked up
Continuation (g) closed the backend half of the last unbuilt APODEX product item —
campus Q&A over a reviewed public document set — and explicitly named the next
increment:

> *Next increment: a landing-page search box + indexable `/help` route in front of
> the new Q&A API (the API and question list are ready for it).*

This session shipped exactly that frontend half. The referenced
`apodex-deliverables-20260927-2359.zip` was again not present in the sandbox; the
in-repo `docs/APODEX_CONTINUATION_*` chain and the two uploaded continuation notes
served as the research files.

## What shipped
1. `src/lib/campus-qa.ts` — typed client for `GET /api/public/campus-qa` and
   `/campus-qa/questions`. Defence-in-depth mirroring `public-listings.ts`: every
   payload is re-shaped into a whitelisted DTO (`sanitizeCampusAnswer`,
   `sanitizeCampusQuestions`), confidence is clamped to [0,1], text is length-capped,
   `answer`/`entry` are nulled whenever `matched === false`, and arrays are rejected
   as answer payloads. No field the server did not intend for the UI can reach it.
2. `src/components/CampusQaSearch.tsx` — landing-page search box for signed-out
   visitors: 350 ms debounce, in-flight abort + sequence guard so a slow earlier
   response can never overwrite a newer one, reviewed-answer card with topic badge
   and source citation, honest "no reviewed answer yet" state for unmatched queries
   (never a fabricated answer), related-question chips, and the 108/112 + OTP/UPI
   safety disclaimer under every result. Renders nothing but a quiet retry note on
   API failure.
3. `src/pages/HelpPage.tsx` + public route `/help` — indexable campus help desk.
   Fetches the reviewed question list, groups by topic, lazy-fetches the verbatim
   cited answer on expand, Helmet title/description for SEO, links to
   Privacy/Terms/Signup. No auth, no student data.
4. `src/test/lib/campus-qa.test.ts` — 6 tests: query capping/encoding, field
   whitelisting (owner-PII leak guard), null-on-unmatched, confidence clamping,
   malformed-payload rejection (including the array-vs-object edge the first run
   caught), related-question cap of 3, question-list sanitisation.

No schema change, no migration, no new dependency, no auth surface touched.

## Validation
- New frontend suite: **6/6 passed** (first run caught the array-payload edge;
  fixed in the sanitizer, then green).
- Full frontend suite: **23 files, 556/556 passed** (up from 550).
- Strict `tsc -p tsconfig.app.json --noEmit`: **exit 0**.
- `vite build`: **green**; `HelpPage` and `campus-qa` emitted as separate lazy
  chunks (2.16 kB + 0.67 kB gzip) — zero cost to first paint.
- CI on the PR: GitGuardian, build-and-test (20.x, 22.x), exchange-evidence-integration.

## Council notes (parallel review)
- *Privacy seat:* the UI can only ever render reviewed corpus text; the client
  sanitizer plus the server PII-regex corpus test are two independent walls.
- *Trust seat:* unmatched queries get an honest refusal and pointers, never a
  confident guess — the product would rather say "we don't know yet" than be wrong
  on a safety question.
- *Growth seat:* `/help` is public + Helmet-described so search engines can index
  the reviewed Q&A corpus; the landing search box gives anonymous visitors a
  reason to trust before they sign up.
- *Performance seat:* both surfaces are lazy chunks off the critical path; the
  landing box debounces and aborts, so typing costs at most ~3 requests.

## Premortem — failure modes and the fix already in code
| Failure | Fix in code |
|---|---|
| Server regression leaks unexpected fields into signed-out UI | Client whitelists DTO; test asserts `owner`/PII fields never survive sanitisation |
| Slow network → stale answer overwrites a newer query | AbortController + monotonically increasing request sequence |
| Rate-limited API (429) breaks the landing page | Component degrades to a one-line retry note; page otherwise intact |
| Low-confidence question gets a made-up answer | API refuses below 0.18; UI shows "no reviewed answer yet" + related reviewed questions |
| SEO page shows stale answers | Answers are fetched live from the corpus at expand time, not baked in |

## Owner actions still open (unchanged, real)
1. **Rotate the GitHub PAT** — it has appeared in plain text across 8 task prompts. Burned.
2. DNS + hosting for `rgitrozgar.in`; watch the first real VPS deploy by hand.
3. Set `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`, `DEPLOY_ENV_FILE` in repo secrets.
4. Campus pilot with pre-agreed success metrics before any traction claim.
5. Next increments: wire aggregate unmatched-query logging (no user id) so the
   corpus grows where demand is; sitemap entry for `/help`.

No placeholder data, no fake metrics, no unreviewed change reached `main`.
