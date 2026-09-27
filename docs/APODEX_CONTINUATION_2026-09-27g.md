# APODEX Continuation (g) - Campus Q&A over a reviewed document set

**Date:** 27 September 2026  
**Repository:** https://github.com/Kartik24Hulmukh/unified-experience  
**Base:** `main@d835d67` (PRs #5, #6, #7 merged; strict tsc green and CI-gated)

---

## 1. State on arrival

Continuation (f) closed out the strict-TypeScript work and left an explicit
remaining-work list. Re-reading it against the repo:

| Carried-forward item | Status now |
|---|---|
| Merge PR #6 / PR #7 | Done in (f). `main` = `d835d67`. |
| cwd-independence tweaks in two frontend tests | **Deliberately dropped** - see section 5. |
| **Campus Q&A over a reviewed public document set (APODEX priority)** | **Built this session.** |
| PAT rotation, DNS, VPS secrets, pilot | Owner actions, still open. |

The Q&A capability was the only unbuilt product item left in the APODEX chain,
so this session implemented it end to end on the server, with tests.

---

## 2. Council meeting (five parallel perspectives)

**Product.** The highest-friction moment for a new student is not browsing, it is
*not knowing how the thing works or whether it is safe*. A cited answer engine on
the public surface converts curiosity into a verified signup and is indexable -
real top-of-funnel traction, not a vanity metric.

**Security / privacy.** An answer engine is the single easiest place to leak PII.
Ruling: the corpus is a static, human-reviewed, in-repo file. It may contain no
student records, no listing owner data, no emails, no phone numbers, and it is
never fed from user-generated content - so prompt/content poisoning has no path in.

**Reliability.** No external LLM call on a public, unauthenticated route: no API
key to leak, no vendor outage, no per-query cost, no non-determinism. Retrieval is
lexical (IDF-weighted, field-boosted), O(corpus) and microsecond-fast, with the
same rate-limit and cache-header discipline as `/api/public/listings`.

**Measurement.** Confidence is returned with every answer, so unmatched queries
can later be mined (aggregate, no user id) to decide which reviewed document to
write next. Coverage is a real metric; "questions asked" is not.

**UX.** Refusal is a feature. Below the confidence floor the API returns
`matched: false` plus related reviewed questions instead of a confident wrong
answer - critical when the topic is a medical emergency or a payment scam.

---

## 3. What shipped

- `server/src/data/campusKnowledge.ts` - 14 reviewed entries (account, exchange,
  safety, privacy, directory, support). Every entry carries an in-repo `source`
  so any answer is auditable back to a reviewed document.
- `server/src/services/campusQaService.ts` - deterministic retrieval:
  stopword-stripped tokenisation with light stemming, IDF built over the corpus,
  field boosts (keywords 3x / question 2x / answer 1x), score normalised to a
  0-1 confidence, refusal below 0.18, plus `listCampusQuestions()`.
- `server/src/routes/public.ts`
  - `GET /api/public/campus-qa?q=...` - 30 req/min, `max-age=300`, 400 on empty
    or >200-char queries.
  - `GET /api/public/campus-qa/questions` - 60 req/min, `max-age=600`; the full
    reviewed question list for suggestion chips and indexable help pages.
- `server/tests/campus-qa.test.ts` - 8 tests, no DB, no network.

No schema change, no migration, no new dependency, no auth surface touched.

---

## 4. Premortem and the 100x fix applied

| Failure mode | Why it would happen | Fix already in the code |
|---|---|---|
| Q&A hallucinates a wrong safety answer | Generative model on a public route | No model. Answers are verbatim reviewed text, always cited. |
| Corpus poisoned by user content | Ingesting listings/messages | Corpus is a static in-repo file reviewed via PR. |
| PII leaks through an answer | Reusing internal models | Corpus is prose-only; a test fails the build if any email or 10-digit phone pattern appears. |
| Silent quality rot as the corpus grows | No regression net | Every entry must be retrievable from its own question (test 3); intent->entry table locks the 8 core intents. |
| Public endpoint abused as free compute | Unlimited anonymous calls | 30/min rate limit, 200-char cap, cacheable responses. |
| Confident answer to an out-of-scope question | No floor | Confidence floor 0.18 -> `matched:false` + related questions. |

---

## 5. Validation run

```
server vitest  tests/campus-qa.test.ts .......... 8/8 PASSED
npm install (root + server) ...................... clean
cwd-independence experiment ...................... REVERTED
```

The carried-forward cwd tweak was attempted and **reverted on evidence**:
`import.meta.url` is not a `file:` URL under the Vitest transform, so
`fileURLToPath` throws and both suites fail. `process.cwd()` is correct for this
runner and the suites already pass 550/550 from the repo root. Recording the
negative result is worth more than shipping a broken "improvement".

Pre-existing local `tsc` errors in `server/` are all `@prisma/client` member
lookups that require `prisma generate` (not run in this sandbox); none of them
are in the new files and CI generates the client before compiling.

---

## 6. Remaining owner actions (unchanged, still real)

1. **Rotate the GitHub PAT** - it has appeared in seven task prompts. Treat as burned.
2. DNS + hosting for `rgitrozgar.in`; watch the first real VPS deploy by hand.
3. Set `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`, `DEPLOY_ENV_FILE`.
4. Front the Q&A endpoint with a landing-page search box and an indexable
   `/help` route (next natural increment; the API and question list are ready).
5. Run the campus pilot with pre-agreed success metrics. No traction is claimed here.
