# Testing Practices

## Frameworks
- **Vitest:** Primary runner for frontend unit tests and fast backend unit tests. (`test:watch`, `test:coverage`)
- **Playwright:** Extensively used for End-to-End (E2E) UI testing. Used in CI and for "Beast Mode" production-readiness checks.
  - Tests exist in the `e2e/` folder.
  - Commands: `test:e2e`, `test:e2e:mobile`, `test:e2e:ui`.
- **Testing Library / jsdom:** For React Component tests. (`@testing-library/react`).

## Structure & Coverage
- Frontend unit tests reside primarily in `src/test/` or alongside components depending on their nature.
- Backend tests live in `server/tests/` (e.g., `auth.test.ts`, `listings.test.ts`, `requests.test.ts`, `fsm.test.ts`).
- E2E flows cover full mock-scenario verification for Admin flows, roles testing (Verified Student, Security Boundaries), and stability checks (like locking, stale states).

## Mocking strategy
The frontend previously utilized an in-process mock API interceptor logic (to demonstrate UI logic rapidly). The new Fastify backend is replacing this mock service, but elements of mocking may be preserved for fast unit test runs using tools like mock-service-worker (MSW) or vitest stubbing.
