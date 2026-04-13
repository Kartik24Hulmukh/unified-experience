# Testing Guide

## Commands
- Unit/Integration: `npm test`
- Coverage: `npm run test:coverage`
- E2E full: `npm run test:e2e`
- E2E focused flow: `npx playwright test e2e/flow_verification.spec.ts`

## E2E Policy
- Do not swallow assertion errors in end-to-end specs.
- Avoid false positives from `catch` blocks that only log.
- Prefer explicit `expect(...).toBeVisible()` and fail fast for critical workflows.

## Critical Production Flow
`e2e/flow_verification.spec.ts` validates:
- Student creates resale listing
- Admin can locate and approve listing
- Student creates academic listing
- Admin can locate and approve listing

## Current Live Failure Signal
- Admin step can fail because `/admin` lands on `/home` in live runs.
- This is a real production issue and should not be masked by test stubs or forced role overrides.

## Debug Checklist
1. Capture URL immediately after navigating to `/admin`.
2. Capture localStorage user role (`berozgar_auth`).
3. Capture `/auth/me` payload and compare role with login payload.
4. Confirm ProtectedRoute role gate behavior under hydration edge timing.
