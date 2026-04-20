# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- React pages and components use PascalCase filenames such as `src/pages/ProfilePage.tsx`, `src/pages/LoginPage.tsx`, and `src/components/ResourceListingForm.tsx`.
- Hooks use `use*` filenames such as `src/hooks/useRestriction.ts` and `src/hooks/api/useApi.ts`.
- Backend services use verb-focused camelCase filenames such as `server/src/services/authService.ts` and `server/src/services/listingService.ts`.
- Tests use `*.test.ts`, `*.test.tsx`, or `*.spec.ts` depending on the runner and scope.

**Functions:**
- Components and hooks are named after the thing they render or return, with hooks prefixed by `use`.
- Pure domain functions use descriptive verbs such as `computeTrust`, `computeRestriction`, `createListingMachine`, and `applyRequestEvent`.
- Route handlers and service methods are verb-first and intent-revealing, such as `signup`, `verifyOtp`, `getProfile`, and `recoverStaleTransactions`.

**Variables:**
- Booleans use `is*`, `has*`, `can*`, or `should*` prefixes.
- Query results are commonly named `response`, `result`, or `data`, then narrowed into role-specific names.
- Temporary request values are named after the domain concept instead of generic `temp` or `value`.

**Types:**
- Exported interfaces and union types model API contracts and domain state, for example `Profile`, `AuthState`, `ListingStatus`, and `RestrictionResult`.
- DTOs and derived types live beside their schemas in `server/src/shared/validation.ts` and `server/src/shared/response.ts`.

## Code Style

**Formatting:**
- TypeScript is the primary language across the repo.
- The client build uses `tsconfig.app.json` with relaxed strictness, while the server build uses a strict `server/tsconfig.json`.
- Imports generally prefer the `@/` alias for application code and direct package imports for external dependencies.
- The repo uses semicolons and standard ESLint formatting conventions.

**Linting:**
- Frontend linting is configured in `eslint.config.js` with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`.
- `@typescript-eslint/no-explicit-any` is enforced as an error in the client config.
- `react-refresh/only-export-components` is warning-only, which allows context co-location patterns such as `src/contexts/AuthContext.tsx`.

## Import Organization

**Order:**
1. External packages.
2. Aliased application imports from `@/` or `@berozgar/shared`.
3. Relative imports within the current feature folder.
4. Type-only imports grouped with the symbol they describe.

**Path Aliases:**
- Client code uses `@/*` through Vite and TypeScript path aliases.
- Server code also uses `@/*` through `server/tsconfig.json`.
- The server package depends on the sibling shared package as `@berozgar/shared` via `file:../shared`.

## Error Handling

**Patterns:**
- Server code throws domain-specific errors such as `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, and `NotFoundError`.
- The Fastify app converts those errors in `server/src/app.ts` into stable JSON responses with sanitized messages.
- Client code wraps network failures as `ApiError` in `src/lib/api-client.ts` and surfaces them through toasts or route redirects.
- `src/components/ErrorBoundary.tsx` is used to isolate UI failures by page and route segment.

## Logging

**Framework:**
- Client logging flows through `src/lib/logger.ts` and `src/lib/monitoring.ts`.
- Server logging flows through Fastify/pino and `request.log`.

**Patterns:**
- Validation middleware in `server/src/middleware/validate.ts` intentionally avoids logging request bodies so passwords, OTPs, and PII do not land in logs.
- Fire-and-forget side effects such as audit logging and fraud heuristics usually swallow secondary failures to avoid breaking primary user flows.

## Comments

**When to Comment:**
- Comments are used to document race-condition guards, security invariants, and lifecycle ordering that are easy to regress.
- `FIX`, `SEC`, `CRIT`, and similar markers are used to explain why a guard exists, not to narrate obvious code.

**JSDoc/TSDoc:**
- Public services, route modules, and test helpers often carry short JSDoc blocks.
- Co-located hook exports sometimes include `eslint-disable` comments when the hook and provider intentionally live in the same file.

## Function Design

**Size:**
- UI components stay composition-heavy and delegate data access to hooks.
- Client and server service methods own the side effects; domain modules stay pure and deterministic.
- Backend route handlers are thin orchestration layers that validate, delegate, and shape the response.

**Parameters:**
- Functions prefer object parameters when there are multiple optional fields or domain-specific flags.
- Route and mutation methods pass explicit DTOs rather than unstructured maps.

**Return Values:**
- Route handlers return normalized envelopes from `server/src/shared/response.ts` or auth payloads with a stable JSON shape.
- React Query hooks return query/mutation objects rather than ad hoc state.

## Module Design

**Exports:**
- Pages typically default-export the route component.
- Hooks, utilities, and service modules usually use named exports.
- Pure domain modules export both the computation function and the associated types or threshold constants for tests.

**Barrel Files:**
- Barrel usage is minimal.
- `shared/src/index.ts` is the primary shared entrypoint; otherwise the repo prefers direct imports from the concrete file.

## State Management

**Client State Split:**
- Identity and hydration live in `src/contexts/AuthContext.tsx`.
- Profile data lives in `src/contexts/ProfileContext.tsx` and React Query.
- Session token and cross-tab sync live in `src/lib/session.ts`.
- Server state and caching live in `src/hooks/api/useApi.ts`.

**Server State Split:**
- Authentication, profile, and moderation logic stay in services.
- Transactions and state transitions are handled inside Prisma-backed service methods, not in route handlers.

---

*Convention analysis: 2026-04-15*
