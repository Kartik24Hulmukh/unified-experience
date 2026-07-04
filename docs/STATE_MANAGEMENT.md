# State Management

## Auth State
`AuthContext` stores:
- `user`
- `isAuthenticated`
- `isLoading`
- `isHydrated`
- `trust`
- `restriction`

## Session Manager Responsibilities
- Keep access token in memory
- Schedule proactive refresh events
- Sync cross-tab login/logout events
- Persist only non-sensitive user profile fields in localStorage

## Safety Practices Implemented
- Mount-safe state updates in auth flows
- Hydration run guard to prevent stale async state writes
- Single-flight token refresh guard to prevent overlapping refresh requests
- Cleanup for pending timers on provider teardown

## React Query Rules
- Use explicit invalidation after mutation for admin moderation flows.
- Avoid broad invalidation on every route change.
- Keep stale times explicit per data domain.

## Known Gap
- Admin role consistency across `/auth/login` and `/auth/me` needs verification in live backend responses.
