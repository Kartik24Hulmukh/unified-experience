# Production Readiness

## Completed
- Accessible loading fallback (`role=status`, `aria-live=polite`, `aria-busy=true`).
- Auth lifecycle hardening to reduce stale async state commits.
- Token refresh single-flight guard in auth event handling.
- E2E flow tests upgraded to fail on real errors instead of logging-only pass.
- Build passes (`npm run build`).

## Blocking Issues
- End-to-end admin moderation flow is not deterministic in production URL tests.
- During strict E2E, `/admin` consistently resolves to `/home` for admin credentials, preventing listing moderation actions.
- Latest strict run failed both flows with: `Failed to stay on /admin after retries, current URL: https://rgitrozgar.in/home`.

## Must-Fix Before Release
1. Resolve admin-route consistency under real auth hydration and `/auth/me` reconciliation.
2. Validate server-side role reconciliation so `/auth/login` and `/auth/me` return consistent role state for admin users.
3. Re-run `e2e/flow_verification.spec.ts` until both flows pass without role overrides.
4. Keep the Playwright admin-route regression guard enabled to prevent silent regressions.
5. Monitor chunk sizes for `vendor-three-core` and `vendor-rapier` to reduce startup pressure.

## Verification Gates
- `npm run build`
- `npm test`
- `npx playwright test e2e/flow_verification.spec.ts`
- No critical E2E failures in auth-protected routes
