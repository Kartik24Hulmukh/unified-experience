# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```text
[project-root]/
├── src/                  # Frontend app: pages, components, contexts, hooks, client domain, and UI helpers
├── server/               # Standalone Fastify API package with Prisma, middleware, routes, and tests
├── shared/               # Shared package entrypoint for common schemas/types consumed by the server package
├── e2e/                  # Playwright end-to-end scenarios and DB-backed helpers
├── docs/                 # Product docs, audits, legal policies, and research artifacts
├── .planning/            # Generated planning and codebase-analysis artifacts
├── dist/                 # Frontend build output
├── playwright-report/    # Playwright HTML report output
├── test-results/         # Frontend Playwright/Vitest artifacts and run output
└── server/prisma/        # Server schema, migrations, seed scripts, and dev database file
```

## Directory Purposes

**`src`:**
- Purpose: Browser application and frontend test surface.
- Contains: Route pages, shared UI components, auth/profile contexts, React Query hooks, domain engines, and client utilities.
- Key files: `src/main.tsx`, `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/hooks/api/useApi.ts`, `src/lib/api-client.ts`, `src/domain/profile.ts`.

**`server`:**
- Purpose: Backend service, database schema, backend tests, and operational scripts.
- Contains: Fastify app code, Prisma schema, route handlers, service modules, plugins, middleware, and server-specific test suites.
- Key files: `server/src/app.ts`, `server/src/server.ts`, `server/src/routes/auth.ts`, `server/src/services/authService.ts`, `server/prisma/schema.prisma`.

**`shared`:**
- Purpose: Package boundary for common schemas and types exported as `@berozgar/shared`.
- Contains: A small public entrypoint and package metadata.
- Key files: `shared/src/index.ts`, `shared/package.json`, `shared/tsconfig.json`.

**`e2e`:**
- Purpose: Playwright full-stack scenarios that exercise the live local stack.
- Contains: End-to-end specs, helpers, and workflow documentation.
- Key files: `e2e/smoke.spec.ts`, `e2e/role-based-e2e.spec.ts`, `e2e/helpers.ts`, `e2e/auth-behavior.spec.ts`.

**`docs`:**
- Purpose: Reference material that is not executed by the app.
- Contains: Audits, legal documents, and imported documents/spreadsheets.
- Key files: `docs/audits/*`, `docs/legal/*`.

**`.planning`:**
- Purpose: Generated planning artifacts and codebase maps.
- Contains: Phase plans, codebase documentation, and other orchestrator output.
- Key files: `.planning/codebase/*.md`.

**`server/prisma`:**
- Purpose: Database schema and lifecycle assets.
- Contains: `schema.prisma`, migrations, seed logic, and a local dev database file.
- Key files: `server/prisma/schema.prisma`, `server/prisma/seed.ts`.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Frontend bootstrap.
- `src/App.tsx`: Frontend router and provider stack.
- `server/src/server.ts`: Backend process entry.
- `server/src/app.ts`: Backend Fastify factory.

**Configuration:**
- `package.json`: Frontend scripts, dependency graph, and Vite entry points.
- `server/package.json`: Backend scripts and server-only dependencies.
- `vite.config.ts`: Frontend dev proxy and build splitting.
- `playwright.config.ts`: E2E defaults and base URL.
- `server/src/config/env.ts`: Backend env validation.
- `src/lib/env.ts`: Frontend env validation.

**Core Logic:**
- `src/contexts/AuthContext.tsx`: Client auth hydration and session sync.
- `src/contexts/ProfileContext.tsx`: Client profile cache.
- `src/hooks/api/useApi.ts`: React Query API hooks.
- `src/domain/*`: Client trust/restriction/profile logic.
- `server/src/services/*`: Backend business logic.
- `server/src/domain/*`: Backend FSM and policy logic.

**Testing:**
- `src/test/**/*`: Frontend unit and component tests.
- `server/tests/**/*`: Backend route and lifecycle tests.
- `e2e/**/*`: Playwright tests and fixtures.

## Naming Conventions

**Files:**
- Components and pages use PascalCase filenames such as `src/pages/ProfilePage.tsx` and `src/components/ResourceListingForm.tsx`.
- Hooks use `use*` camelCase filenames such as `src/hooks/useRestriction.ts` and `src/hooks/api/useApi.ts`.
- Service modules use verb-focused camelCase filenames such as `server/src/services/authService.ts` and `src/services/fraudService.ts`.
- Test files use `*.test.ts`, `*.test.tsx`, or `*.spec.ts` depending on runner and scope.

**Directories:**
- Feature groupings use lowercase nouns such as `components`, `pages`, `services`, `domain`, and `routes`.
- Tests are grouped by concern rather than by framework, such as `src/test/domain` and `src/test/fsm`.

## Where to Add New Code

**New Frontend Feature:**
- Primary code: `src/pages/<Feature>Page.tsx` or `src/components/<Feature>.tsx`.
- Shared UI logic: `src/hooks/api/useApi.ts` for API wiring and `src/lib/*` for non-UI helpers.
- Tests: `src/test/<area>/`.

**New Frontend Domain Rule:**
- Implementation: `src/domain/<rule>.ts` or `src/lib/fsm/*` if it is transition logic.
- Tests: `src/test/domain` or `src/test/fsm`.

**New Backend Endpoint:**
- Route: `server/src/routes/<resource>.ts`.
- Business logic: `server/src/services/<resource>Service.ts`.
- Validation: `server/src/shared/validation.ts`.
- Response shaping: `server/src/shared/response.ts`.

**New Backend Persistence Change:**
- Schema: `server/prisma/schema.prisma`.
- Migration: `server/prisma/migrations/*`.
- Seed or repair scripts: `server/prisma/seed.ts` or `server/scripts/*`.

**New Shared Contract:**
- Preferred home: `shared/src/index.ts` if the contract is meant for both packages.
- Backend-facing contract layer: `server/src/shared/validation.ts` and `server/src/shared/response.ts`.

**New Integration Test:**
- Full-stack scenario: `e2e/*.spec.ts`.
- Server route test: `server/tests/*.test.ts`.
- Frontend component test: `src/test/**/*.test.tsx`.

## Special Directories

**`dist`:**
- Purpose: Frontend production build output.
- Generated: Yes.
- Committed: No.

**`server/dist`:**
- Purpose: Backend TypeScript build output.
- Generated: Yes.
- Committed: No.

**`playwright-report`:**
- Purpose: Playwright HTML report artifacts.
- Generated: Yes.
- Committed: No.

**`server/scripts/logs`:**
- Purpose: Debug output, captured runtime logs, and local investigation artifacts.
- Generated: Yes.
- Committed: No.

**`server/prisma/dev.db`:**
- Purpose: Local SQLite artifact used in some workflows and generated tooling paths.
- Generated: Yes.
- Committed: No.

---

*Structure analysis: 2026-04-15*
