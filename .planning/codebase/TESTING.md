# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Runner:**
- Frontend and most pure logic tests use Vitest.
- Server route tests also use Vitest with Fastify injection.
- Full-stack scenarios use Playwright.

**Config:**
- Frontend config: `vitest.config.ts`.
- Backend package config: `server/package.json` with `vitest` and `server/tsconfig.json`.
- Playwright config: `playwright.config.ts`.
- Shared frontend test setup: `src/test/setup.ts`.

**Run Commands:**
```bash
npm run test
npm run test:watch
npm run test:coverage
npm run test:e2e
```

## Test File Organization

**Location:**
- Frontend tests are co-located under `src/test/` and grouped by concern.
- Backend tests live under `server/tests/`.
- End-to-end tests live under `e2e/`.

**Naming:**
- Unit and integration tests use `.test.ts` or `.test.tsx`.
- Browser scenarios use `.spec.ts`.

**Structure:**
```text
src/test/
├── domain/
├── fsm/
├── lib/
└── pages/
server/tests/
e2e/
```

## Test Structure

**Suite Organization:**
```ts
import { describe, it, expect } from 'vitest';
import { computeTrust } from '@/domain/trustEngine';

describe('Trust Engine: Admin Flags → RESTRICTED', () => {
  it('1 admin flag → RESTRICTED', () => {
    const result = computeTrust(cleanInput({ adminFlags: 1 }));
    expect(result.status).toBe('RESTRICTED');
  });
});
```

**Patterns:**
- Domain tests use table-driven or scenario-driven `describe` blocks.
- React component tests render through `MemoryRouter` and mock only the surrounding context or router APIs.
- Server tests build the Fastify app once, call `await app.ready()`, then use `app.inject(...)` for requests.
- E2E tests run against the real app stack and keep shared state in helpers or module-level fixtures.

## Mocking

**Framework:**
- Vitest `vi.mock` is the standard mocking tool.

**Patterns:**
```ts
vi.mock('@/services/authService', () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

const res = await app.inject({
  method: 'POST',
  url: '/api/auth/login',
  payload: { email: 'test@mctrgit.ac.in', password: 'Secure@1234' },
});
```

**What to Mock:**
- Mock Prisma, network clients, auth contexts, and router hooks at the boundary.
- Mock `@/services/*` in server route tests when the route contract is the thing under test.
- Mock `AuthContext`, `react-router-dom`, and heavy UI shells in component tests.

**What NOT to Mock:**
- Do not mock the pure domain engines in `src/domain/*` or `server/src/domain/*` when the test is explicitly checking policy or FSM behavior.
- Do not mock the response normalization helpers unless the test is targeting those helpers directly.

## Fixtures and Factories

**Test Data:**
```ts
function cleanInput(overrides: Partial<TrustInput> = {}): TrustInput {
  return {
    completedExchanges: 10,
    cancelledRequests: 0,
    disputes: 0,
    adminFlags: 0,
    accountAgeDays: 60,
    ...overrides,
  };
}
```

**Location:**
- Frontend tests often inline small factories near the suite.
- E2E fixtures and DB helpers live in `e2e/helpers.ts`.
- Browser-oriented tests seed session state through `sessionStorage` or mocked hooks.

## Coverage

**Requirements:**
- No explicit coverage gate is enforced in the repo config.
- `npm run test:coverage` is available for frontend coverage reporting.
- `server/package.json` exposes `npm test` and `npm run test:watch` but not a dedicated coverage command.

**View Coverage:**
```bash
npm run test:coverage
cd server && npm test
```

## Test Types

**Unit Tests:**
- Pure domain logic, validation helpers, and small utility modules.
- Example directories: `src/test/domain`, `src/test/fsm`, `src/test/lib`.

**Integration Tests:**
- Backend route tests that wire Fastify, mocked services, and validation middleware together.
- Frontend component tests that verify context behavior, routing, and callback wiring.

**E2E Tests:**
- `e2e/smoke.spec.ts`, `e2e/role-based-e2e.spec.ts`, and related scenarios drive the live frontend, API, and database.
- `playwright.config.ts` does not define a `webServer`; the stack must be running separately or started by helper scripts.

## Common Patterns

**Async Testing:**
```ts
await waitFor(() => {
  expect(mockVerifyOtp).toHaveBeenCalledWith('123456');
});
```

**Error Testing:**
```ts
const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: badPayload });
expect(res.statusCode).toBe(400);
```

**Full-Stack Helpers:**
- `e2e/helpers.ts` uses a raw `pg` pool against the same PostgreSQL instance as the app to read OTP rows and seed verified users.
- `e2e/smoke.spec.ts` and `e2e/role-based-e2e.spec.ts` model the signup -> listing -> request -> dispute journey.

---

*Testing analysis: 2026-04-15*
