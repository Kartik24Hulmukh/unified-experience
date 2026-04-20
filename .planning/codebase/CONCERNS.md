# Codebase Concerns

**Analysis Date:** 2026-04-15

## Tech Debt

**Contract duplication across client, backend-local shared code, and the shared package:**
- Issue: Validation and response shaping are defined in three places: `src/lib/validation.ts`, `server/src/shared/validation.ts`, and `shared/src/index.ts`.
- Files: `src/lib/validation.ts`, `server/src/shared/validation.ts`, `server/src/shared/response.ts`, `shared/src/index.ts`.
- Impact: Frontend forms, server validation, and shared DTOs can drift independently, which makes API changes fragile and hard to reason about.
- Fix approach: Promote one canonical shared contract package and import it consistently from both the client and server.

**Stale runtime/config helpers:**
- Issue: `src/lib/runtime-config.ts` appears to be a standalone configuration module with no consumer in `src`.
- Files: `src/lib/runtime-config.ts`.
- Impact: Dead configuration surfaces increase maintenance cost and can mislead future changes about where runtime behavior actually comes from.
- Fix approach: Remove the module or wire it into real call sites; keep environment behavior in one place.

**Frontend validation helper drift:**
- Issue: `src/lib/validation.ts` duplicates server validation semantics but is not imported by the frontend app.
- Files: `src/lib/validation.ts`.
- Impact: It creates a second schema source that can silently fall out of sync with `server/src/shared/validation.ts`.
- Fix approach: Delete it or make it a thin re-export of the canonical schema package.

## Known Bugs

**Missing CSRF token route expected by the client and E2E helpers:**
- Symptoms: `src/lib/api-client.ts` retries failed mutations by calling `/api/auth/csrf-token`, and `e2e/helpers.ts` also reads that endpoint, but `server/src/routes/auth.ts` does not define it.
- Files: `src/lib/api-client.ts`, `e2e/helpers.ts`, `server/src/routes/auth.ts`, `server/src/plugins/csrf.ts`, `server/src/app.ts`.
- Trigger: Any 403 CSRF retry path in the client or any E2E helper that tries to read a fresh token.
- Workaround: None visible in the codebase; the current plugin only sets the cookie on requests.
- Fix approach: Add an explicit GET route for `/api/auth/csrf-token` or remove the client/helper dependency and align the refresh strategy with the plugin behavior.

**Logout response mismatch in backend tests:**
- Symptoms: `server/src/controllers/authController.ts` returns `Logged out successfully`, while `server/tests/auth.test.ts` and `server/tests/auth-lifecycle.test.ts` assert `Logged out`.
- Files: `server/src/controllers/authController.ts`, `server/tests/auth.test.ts`, `server/tests/auth-lifecycle.test.ts`.
- Trigger: Running the auth route tests or any assertion that checks the exact logout message.
- Workaround: Update the expectation or normalize the response string.
- Fix approach: Align the route response and the tests to the same message contract.

## Security Considerations

**Client-side secret exposure in the agency integration:**
- Risk: `src/services/agencyService.ts` reads `VITE_GEMINI_API_KEY` and `VITE_GITHUB_TOKEN` in browser code. Vite exposes `VITE_` variables in client bundles.
- Files: `src/services/agencyService.ts`, `src/components/AgentsHub.tsx`, `src/lib/env.ts`.
- Current mitigation: The service falls back to simulation mode when keys are absent.
- Recommendations: Move Gemini and GitHub calls to the backend or a server-side proxy and keep secrets out of the browser bundle entirely.

**Admin status updates lack schema validation:**
- Risk: `server/src/routes/admin.ts` accepts `POST /users/:userId/status` by casting `request.body` instead of validating it with Zod.
- Files: `server/src/routes/admin.ts`, `server/src/services/adminService.ts`.
- Current mitigation: The service throws on invalid actions.
- Recommendations: Add a validation schema so malformed requests return 400 instead of surfacing as generic server errors.

## Performance Bottlenecks

**Not detected as a dominant current bottleneck from static inspection.**
- The architecture already uses React Query caching, FSM guards, and Prisma transactions.
- The main performance risk is more about repeated revalidation and heavy client bundles than a single hot loop.
- Improvement path: Measure page-level bundle size and query churn before optimizing further.

## Fragile Areas

**E2E/local environment assumptions are inconsistent:**
- Files: `e2e/smoke.spec.ts`, `e2e/auth-behavior.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts`.
- Why fragile: `e2e/smoke.spec.ts` hard-codes `http://127.0.0.1:5173`, `e2e/helpers.ts` falls back to PostgreSQL on port `5432`, and the smoke docs still describe a `5433` database while `playwright.config.ts` defaults to `8080` for the web app.
- Safe modification: Centralize API, web, and database URLs in env variables or one shared test config module.
- Test coverage: The Playwright stack already exercises the flow, but the hard-coded ports make it easy to break on a different local setup.

**Auth tests are asserting stale contract details:**
- Files: `server/tests/auth.test.ts`, `server/tests/auth-lifecycle.test.ts`.
- Why fragile: The tests are pinned to the old logout message and to a CSRF token endpoint that is not present in the registered routes.
- Safe modification: Update the tests when the contract changes, or the tests become a false signal.
- Test coverage: These tests are valuable, but only if the asserted API contract matches `server/src/controllers/authController.ts` and `server/src/routes/auth.ts`.

**Browser-side request retry logic depends on backend behavior that is only partially surfaced:**
- Files: `src/lib/api-client.ts`, `src/contexts/AuthContext.tsx`, `server/src/plugins/csrf.ts`.
- Why fragile: The client assumes it can recover from expired CSRF state and refresh failures without an explicit contract endpoint.
- Safe modification: Make the recovery path explicit in the backend API and test it directly.
- Test coverage: There is no focused frontend test for the refresh/CSRF retry branch.

## Missing Critical Features

**No single canonical contract package is actively consumed end-to-end:**
- Problem: The backend uses `server/src/shared/*`, the server package exports `shared/src/index.ts`, and the frontend maintains its own client-side validation module.
- Blocks: Schema changes can be applied in one place and forgotten in another, especially for listing, dispute, and request flows.

## Test Coverage Gaps

**Client auth refresh and CSRF retry path:**
- What's not tested: `src/lib/api-client.ts` refresh-on-401 and CSRF-refresh-on-403 branches.
- Files: `src/lib/api-client.ts`, `src/contexts/AuthContext.tsx`.
- Risk: A small contract change in the backend can break every mutation flow without a targeted regression test.
- Priority: High.

**Contract drift between frontend validation and backend validation:**
- What's not tested: Whether `src/lib/validation.ts` still matches `server/src/shared/validation.ts`.
- Files: `src/lib/validation.ts`, `server/src/shared/validation.ts`.
- Risk: Frontend forms can accept data that the server rejects, or the opposite.
- Priority: High.

**Admin mutation validation:**
- What's not tested: The `POST /api/admin/users/:userId/status` body shape and invalid-input behavior.
- Files: `server/src/routes/admin.ts`, `src/pages/AdminPage.tsx`, `src/hooks/api/useApi.ts`.
- Risk: Invalid payloads can become 500s instead of clean 400s.
- Priority: Medium.

**E2E port and bootstrap assumptions:**
- What's not tested: That the configured frontend, API, and database ports match the local defaults in all scenarios.
- Files: `e2e/smoke.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts`, `e2e/role-based-e2e.spec.ts`.
- Risk: A working app can still fail every E2E run because the tests target the wrong port.
- Priority: High.

---

*Concerns audit: 2026-04-15*
