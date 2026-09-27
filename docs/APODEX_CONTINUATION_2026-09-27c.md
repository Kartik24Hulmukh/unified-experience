# APODEX continuation (c): signed-out "What's on campus now" strip

Date: 27 September 2026. Base: `main@72f693a` (after PR #2).

## Shipped
- `src/lib/public-listings.ts`: a client that calls only `GET /api/public/listings` and sends no auth header (`skipAuth`). The limit is clamped to 1-50 and search text to 80 characters. The client **re-checks every field** against an allowlist (`id,title,category,module,price,createdAt`). Anything that is not APPROVED is dropped. So even if the server regresses and starts sending owner or request data, the landing page cannot show it.
- `src/components/PublicListingsStrip.tsx`: a horizontal strip of real listings for signed-out visitors. It shows **nothing** if the request fails or returns no listings. It never shows placeholder or fake supply. Each card links to `/signup`, carrying `{intent:'public-listing', listingId}` in router state for a later deep link.
- `LandingPage.tsx`: shows the strip only when `!isAuthenticated && !authLoading`.
- `src/test/lib/public-listings.test.ts`: 4 tests. They cover the limit and search clamps, owner/request data being removed, non-approved rows being dropped, bad payloads, price formatting, and relative time.

## Correction to continuation (b)
In (b), the premortem said `@fastify/rate-limit` still had to be registered globally. **That was wrong.** `app.ts` already calls `registerRateLimit(app)` right after `authPlugin` and before any route is registered. That means the per-route setting `config.rateLimit` on `/api/public/listings` (60 requests per minute) is already enforced. Nothing needed changing.

## Checks run
| Check | Result |
|---|---|
| Frontend vitest | 545 passed. The one failure, `admin-route-aliases`, happened only because vitest was started from outside the repo (the test reads `process.cwd()/src/App.tsx`). It is not a code failure. |
| `vite build` | Passed |
| Server | No changes |

## Premortem
| What could go wrong | What's in place |
|---|---|
| The public API is down, so the landing page looks broken | The strip hides itself. The hero and the call to action are unaffected |
| Fake listings used to suggest traction | Only real APPROVED rows are shown, and there is no fallback data |
| PII leaks if the server DTO drifts | Allowlist check on the client, plus the existing server contract tests |
| Layout overlap on small screens | The strip scrolls sideways. Still needs a visual check on staging at 360px width |

## Still open (owner action)
1. Revoke and rotate the GitHub PAT. It is still being pasted into task prompts.
2. DNS and hosting for rgitrozgar.in. Rehearse migrations on a restored backup first.
3. Fix `deploy.yml`: it uses a registry image that CI does not publish, health-checks the wrong target, and does not copy client-dist.
4. Campus Q&A that only searches a reviewed public document set. Then a pilot with success metrics decided in advance. No traction numbers are claimed.
