# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** Dual-package full-stack SPA with a contract-driven Fastify API and a domain-first business layer.

**Key Characteristics:**
- The browser app boots in `src/main.tsx` and routes through `src/App.tsx`.
- Client state is split between React Query, `src/contexts/AuthContext.tsx`, `src/contexts/ProfileContext.tsx`, and `src/lib/session.ts`.
- Backend HTTP handling follows route -> service -> Prisma in `server/src/routes/*.ts`, `server/src/services/*.ts`, and `server/prisma/schema.prisma`.
- Shared business rules live in pure TypeScript domain modules in `src/domain/*` and `server/src/domain/*`.
- Cross-cutting concerns are isolated in middleware and plugins under `server/src/middleware/*` and `server/src/plugins/*`.

## Layers

**Presentation Layer:**
- Purpose: Render pages, modals, portals, and route-level experiences.
- Location: `src/pages`, `src/components`, `src/App.tsx`, `src/main.tsx`.
- Contains: Page shells, animated sections, route guards, error boundaries, SEO metadata, and UI primitives from `src/components/ui`.
- Depends on: React Router, React Query, auth/profile contexts, client hooks, and UI components.
- Used by: Browser navigation and Playwright component/e2e tests.

**Client Data and Session Layer:**
- Purpose: Manage tokens, hydrate identity, cache API data, and normalize network failures.
- Location: `src/lib/api-client.ts`, `src/lib/session.ts`, `src/contexts/AuthContext.tsx`, `src/contexts/ProfileContext.tsx`, `src/hooks/api/useApi.ts`.
- Contains: Fetch wrapper, CSRF handling, refresh flow, React Query query/mutation wrappers, and session broadcast logic.
- Depends on: `server/src/routes/*`, `server/src/shared/response.ts`, `server/src/shared/validation.ts`, browser cookies, and localStorage/sessionStorage.
- Used by: All authenticated pages and mutation flows.

**Client Domain Layer:**
- Purpose: Keep trust, restriction, and FSM logic deterministic and testable.
- Location: `src/domain/*`, `src/lib/fsm/*`.
- Contains: Trust and restriction engines, profile type guards, listing and request finite state machines.
- Depends on: Pure TypeScript only.
- Used by: `src/pages/ProfilePage.tsx`, `src/pages/AdminPage.tsx`, `src/components/ResourceListingForm.tsx`, `src/hooks/useRestriction.ts`, and unit tests.

**Backend HTTP Layer:**
- Purpose: Expose authenticated and public API endpoints with consistent validation and error semantics.
- Location: `server/src/app.ts`, `server/src/server.ts`, `server/src/routes/*.ts`, `server/src/controllers/authController.ts`.
- Contains: Route registration, error handler, auth controller, analytics ingestion, health checks, and admin endpoints.
- Depends on: Fastify plugins, middleware, services, shared validation, shared response helpers, and config.
- Used by: Frontend API client and E2E helpers.

**Backend Service and Persistence Layer:**
- Purpose: Own business rules, transaction boundaries, and database writes.
- Location: `server/src/services/*`, `server/src/lib/*`, `server/prisma/schema.prisma`.
- Contains: Auth flows, listing/request/dispute/admin/profile logic, JWT and password helpers, Prisma client, and token hashing.
- Depends on: Prisma, Zod schemas from `server/src/shared/validation.ts`, domain engines, and config.
- Used by: Route handlers only.

**Shared Contract Layer:**
- Purpose: Define the DTO and response envelope contract consumed by the API.
- Location: `shared/src/index.ts`, `server/src/shared/validation.ts`, `server/src/shared/response.ts`.
- Contains: Zod schemas, request/response types, enum normalization, and envelope helpers.
- Depends on: Zod and Prisma enum conventions.
- Used by: Backend routes/services and, indirectly, frontend request/response shapes.

## Data Flow

**Signup and Auth Hydration:**
1. The user submits the sign-up or login UI in `src/pages/SignupPage.tsx` or `src/pages/LoginPage.tsx`.
2. `src/contexts/AuthContext.tsx` calls `src/lib/api-client.ts` and uses `src/lib/session.ts` for user metadata and token state.
3. `server/src/routes/auth.ts` forwards the request to `server/src/controllers/authController.ts` and then `server/src/services/authService.ts`.
4. `server/prisma/schema.prisma` persists OTPs, users, and refresh tokens.
5. The client rehydrates from `/api/auth/refresh` and `/api/auth/me`.

**Listings, Requests, and Disputes:**
1. Feature pages call the React Query hooks in `src/hooks/api/useApi.ts`.
2. `src/lib/api-client.ts` adds Bearer auth, CSRF headers, timeout handling, and refresh retries.
3. Server routes in `server/src/routes/listings.ts`, `server/src/routes/requests.ts`, and `server/src/routes/disputes.ts` validate and dispatch to services.
4. Services enforce FSM transitions and transaction guards before writing via Prisma.
5. Responses are normalized in `server/src/shared/response.ts` and re-cached in React Query.

**Admin and Observability:**
1. `src/pages/AdminPage.tsx` and `src/pages/ProfilePage.tsx` consume admin/profile hooks.
2. `server/src/routes/admin.ts` aggregates moderation, audit, fraud, and recovery data.
3. `src/lib/monitoring.ts` records telemetry and ships analytics to `server/src/routes/analytics.ts`.

## Key Abstractions

**Auth Session:**
- Purpose: Keep access tokens out of persistent browser storage while preserving multi-tab behavior.
- Examples: `src/lib/session.ts`, `src/contexts/AuthContext.tsx`, `server/src/lib/jwt.ts`, `server/src/services/authService.ts`.
- Pattern: Access token in memory, refresh token in httpOnly cookie, user metadata in localStorage.

**Finite State Machines:**
- Purpose: Prevent invalid listing and request transitions.
- Examples: `src/lib/fsm/*`, `server/src/domain/fsm/*`.
- Pattern: Validate `can(...)` before `send(...)`, then persist the new status in a transaction.

**Trust and Restriction:**
- Purpose: Derive behavior gates from user activity instead of hardcoding role checks in the UI.
- Examples: `src/domain/trustEngine.ts`, `src/domain/restrictionEngine.ts`, `server/src/services/profileService.ts`, `server/src/services/adminService.ts`.
- Pattern: Compute on the server, treat the result as authoritative, and mirror it into the client as read-only UX state.

## Entry Points

**Frontend Bootstrap:**
- Location: `src/main.tsx`.
- Triggers: Browser load.
- Responsibilities: Initialize monitoring, install global error handlers, and render the React tree.

**Frontend App Shell:**
- Location: `src/App.tsx`.
- Triggers: React render from `src/main.tsx`.
- Responsibilities: Register providers, suspense boundaries, page transitions, and route guards.

**Backend Bootstrap:**
- Location: `server/src/server.ts`.
- Triggers: `npm run dev` or `npm start` in the server package.
- Responsibilities: Start Fastify, run recovery jobs, handle graceful shutdown, and connect to Prisma.

**Backend App Factory:**
- Location: `server/src/app.ts`.
- Triggers: `buildApp()` from `server/src/server.ts` and tests.
- Responsibilities: Register plugins, hooks, error handling, and routes.

## Error Handling

**Strategy:** Normalize failures at the boundary and keep internal details out of client responses.

**Patterns:**
- `server/src/app.ts` converts Fastify validation, idempotency, auth, and rate-limit failures into stable JSON errors.
- `src/lib/api-client.ts` converts transport, timeout, auth, CSRF, and retry failures into `ApiError`.
- `src/components/ErrorBoundary.tsx`, `src/components/FallbackUI.tsx`, and route-scoped wrappers isolate frontend failures by page.
- `src/main.tsx` renders a crash screen if app bootstrap itself fails.

## Cross-Cutting Concerns

**Logging:** Client code uses `src/lib/logger.ts` and `src/lib/monitoring.ts`; backend code uses Fastify/pino logging and structured audit records.
**Validation:** Shared Zod validation lives in `server/src/shared/validation.ts`; client-only form validation exists in `src/lib/validation.ts`.
**Authentication:** JWT access tokens, refresh cookies, CSRF double-submit protection, and `authenticate`/`authorize` middleware enforce access control.
**Idempotency:** `server/src/middleware/idempotency.ts` protects mutations from double-submit and replay.
**Monitoring:** `src/lib/monitoring.ts` sends events to `server/src/routes/analytics.ts`; backend health is exposed through `server/src/routes/health.ts`.

---

*Architecture analysis: 2026-04-15*
