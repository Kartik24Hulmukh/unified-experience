# APODEX continuation (b) — merge to main + safe public discovery

Date: 27 September 2026. Base: `main@86c114a` + `feat/apodex-exchange-evidence@1cf8022`.

## 1. Integration: exchange threads + durable evidence now on main
The previous increment lived only on `feat/apodex-exchange-evidence`. Meanwhile a separate commit on main
(`86c114a PHASE0`) added a second, conflicting analytics implementation. A naive merge produced a schema with
**two `AnalyticsEvent` models** and an interleaved, syntactically broken `setInterval` block in `server.ts`.

Resolution: the branch implementation supersedes PHASE0 for `schema.prisma`, `server.ts`, `routes/analytics.ts`
and `services/analyticsService.ts` because it (a) ships a real SQL migration (PHASE0 had none, so production
would 500 on the new table), (b) uses a fixed, privacy-minimized event vocabulary instead of arbitrary JSON
properties, (c) applies the 30-day retention stated in the privacy text rather than 180 days, and (d) is covered by
unit + real-PostgreSQL integration tests. The admin funnel endpoint (`GET /api/admin/analytics/funnel`) is preserved.

## 2. Security defects found and fixed (listing visibility)
| ID | Defect (before) | Fix |
|---|---|---|
| PD1 | Anonymous `GET /api/listings` with no `status` returned PENDING_REVIEW, REJECTED, FLAGGED, REMOVED, DRAFT listings with owner names | Non-owner/non-admin viewers are restricted to `APPROVED, INTEREST_RECEIVED, IN_TRANSACTION, COMPLETED`; explicit moderation-status queries return 403 |
| PD2 | Anonymous `GET /api/listings/:id` returned moderation-only listings (existence + content oracle) | Uniform 404 unless viewer is owner or admin |
| PD3 | `GET /api/listings/:id` exposed every request row (buyer IDs + states) to anyone | Owners/admins see all; a buyer sees only their own; anonymous sees none; `Cache-Control: private, no-store` |

## 3. APODEX priority 6 shipped: public read-only discovery
`GET /api/public/listings?module=&category=&search=&cursor=&limit=` — anonymous, cacheable
(`public, max-age=60, stale-while-revalidate=300`), APPROVED only, excludes PUBLIC_USER and restricted sellers,
search bounded to 80 chars, limit 1–50, UUID cursor validation. DTO is exactly
`{id,title,category,module,price,status,createdAt}` — no owner identity, contact, images or request rows.
This enables a signed-out landing preview / SEO surface without removing `ProtectedRoute` from pages whose
payloads contain owner details (the unsafe shortcut the plan warned against).

## Validation
| Check | Result |
|---|---|
| Server unit/contract suite | **136 passed**, 7 skipped (DB suite needs env) — was 125; +11 new in `tests/public-discovery.test.ts` |
| Server `tsc --noEmit` | Pass |
| Server production bundle (`scripts/build.mjs`) | Pass |
| Frontend suite / real-PostgreSQL integration / browser | Not re-run in this increment (no frontend code changed) |

## Premortem (this increment)
| Failure | Mitigation | Remaining gate |
|---|---|---|
| A logged-in non-admin UI relied on seeing pending listings via generic browse | Owner view (`ownerId=self`) and ADMIN keep full visibility | Click-through Profile + Admin moderation on staging |
| Public endpoint scraped | Narrow DTO, bounded page size, cache headers, rate-limit config | Register `@fastify/rate-limit` globally (config is currently inert without it) + CDN cache |
| Buyer loses context on detail page | Buyer still sees own request rows | E2E check of buyer detail page |

## Next priorities (unchanged order from continuation doc, items 1–5 still owner-gated)
1. **Rotate the GitHub token** that has now been pasted in multiple requests.
2. DNS/hosting + staging rehearsal of all migrations on a restored snapshot.
3. Frontend: signed-out “What’s on campus now” strip on LandingPage consuming `/api/public/listings`.
4. Register rate-limit plugin globally; retrieval-only campus Q&A over reviewed public corpus.
5. Consented pilot with pre-registered server-side lifecycle metrics. No traction numbers are claimed here.
