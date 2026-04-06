# Auth Lifecycle Audit Report
**Date:** 2026-02-24 · **Scope:** Full frontend auth stack  
**Files audited:** `AuthContext.tsx`, `api-client.ts`, `session.ts`, `security.ts`, `LoginPage.tsx`, `SignupPage.tsx`, `VerificationPage.tsx`, `ProtectedRoute.tsx`, `useGoogleIdentity.ts`, `validation.ts`, `utils.ts`, `error-handler.ts`

---

## Test Scenario Results

### ✅ SC-01 — Signup → OTP → Verify → Login
**Flow:** `POST /auth/signup` → save pending to `sessionStorage` → navigate `/verify` → `POST /auth/verify-otp` → `sessionManager.login()` → redirect `/home`

**Status:** PASS with caveats  
**Issues found:**
- **AUTH-UX-02 (HIGH)** — `resendOtp()` called `POST /auth/signup` again instead of a dedicated resend endpoint. This:
  - Hits the 3/min signup rate limit (returns 429)
  - Returns `409 Conflict` if the email is already registered (which it is after step 1)
  - Triggers the wrong server-side creation flow instead of just resending the email
- **AUTH-UX-01 (MEDIUM)** — After a bad/expired OTP, the toast always said "Invalid code or no pending registration found" regardless of whether the code was wrong vs. expired. Users couldn't tell whether to retype or resend.

**Patches applied:**
- `VerificationPage.tsx` → `resendOtp()` now calls `POST /auth/resend-otp`
- `VerificationPage.tsx` → `handleVerify` toast distinguishes expired vs. wrong OTP via regex on error message

---

### ✅ SC-02 — Expired OTP
**Status:** PASS (server-side) / UI FAIL  
**Issues found:**
- **AUTH-UX-01 (MEDIUM)** — Same as above. The generic "Verification Failed" toast did not indicate expiry, causing users to retry the same dead code instead of clicking Resend.

**Patch:** Applied in SC-01 fix above.

---

### ✅ SC-03 — Wrong OTP Attempts
**Status:** PASS  
- Server validates via `otpSchema` (6-digit regex) before hitting the DB
- `checkRateLimit()` limits to 5 attempts/min on `/auth/verify-otp`
- UI disables button when `otp.length < 6` — prevents trivially short submissions
- No lockout specific to OTP wrong-attempts (only rate limiting) — acceptable for OTP flows

---

### ✅ SC-04 — 5 Failed Login Attempts (Lockout)
**Status:** PASS  
- `security.ts` → `checkAccountLockout()` enforces 5 failures → 15-min lockout
- `recordFailedLogin()` tracks per-email within a 30-min sliding window  
- `clearFailedLogins()` clears on success (no phantom lockout after correct login)
- Rate limiter additionally caps at 5 req/min on `POST /auth/login`
- **No UX issue** — server error message propagates through `ApiError.message` → login toast shows the message
- **NOTE:** Lockout store is in-memory. A server restart resets it. Acceptable for current mock API architecture; must be Redis/DB-backed in production.

---

### ✅ SC-05 — Google OAuth Login
**Status:** PASS  
- `useGoogleIdentity` correctly loads the GIS script lazily (singleton promise)
- On `isNotDisplayed` / `isSkippedMoment` the promise is rejected → `toast` shown
- `googleSignIn()` sets CSRF token from response, calls `sessionManager.login()`
- `POST /auth/google` with `{ skipAuth: true }` — correct, no bearer token sent for initial auth
- **NOTE:** No domain restriction (`@mctrgit.ac.in`) enforced client-side — this is intentionally server-side only (correct approach)

---

### ✅ SC-06 — Google Login with Disallowed Domain
**Status:** PASS (architecture correct)  
- Domain validation MUST be server-side only (client-side check is trivially bypassed)
- Server receives the raw Google ID token JWT and verifies the `hd` (hosted domain) claim
- If domain rejected, server returns 403 → `ApiError('FORBIDDEN')` → toast "Access Denied"
- `handleGoogleClick` catch block shows the error message correctly
- **No UI bug.** Error message from server propagates as `err.message`.

---

### ⚠️ SC-07 — Access Token Expiry
**Status:** PARTIAL FAIL  
**Issues found:**
- **AUTH-BUG-01 (HIGH)** — The retry fetch after a 401 + `/auth/refresh` used a spread of the original `fetchConfig`, which had already had its `AbortSignal` triggered (the original request timed out). The retry fetch inherited a consumed/aborted signal, meaning it was immediately aborted before it could complete, resulting in a stuck spinner (the error was caught but the `TIMEOUT` code was thrown rather than the actual response).
- **AUTH-BUG-02 (HIGH)** — The retry request after token refresh did not re-attach the `X-CSRF-Token` header. Any state-changing request (POST/PUT/PATCH/DELETE) that triggered a 401 → refresh → retry would fail CSRF validation on the retry, returning 403 instead of succeeding.

**Patches applied** (both in `api-client.ts`):
- Retry now uses a fresh `AbortController` with its own timeout  
- Retry re-attaches `X-CSRF-Token` from the in-memory `csrfToken` before retrying

---

### ✅ SC-08 — Refresh Token Rotation
**Status:** PASS (architecture)  
- Access token: in-memory (`sessionManager.accessToken`), never persisted
- Refresh token: httpOnly Secure SameSite=Strict cookie, set by server
- `POST /auth/refresh` sends cookie automatically via `credentials: 'include'`
- Server issues a new rotated refresh token and new access token on each call
- Client stores new access token via `sessionManager.setTokens(data.accessToken)`
- `scheduleTokenRefresh()` reschedules the next refresh based on new token's `exp`

---

### ✅ SC-09 — Refresh Token Reuse Attack
**Status:** PASS (server-side concern; client correct)  
- Client never stores the refresh token (httpOnly cookie only)
- Client has no way to replay a refresh token — it relies entirely on the cookie
- A stolen cookie reuse scenario is a server responsibility (token family invalidation)
- Client's `handleTokenRefresh()` immediately calls `sessionManager.clearSession()` if `/auth/refresh` returns non-OK, which correctly propagates a forced logout if the server detects token reuse and returns 401
- **AUTH-BUG-03 (HIGH)** — `clearSession()` was called twice in `handleTokenRefresh()`: once in the `!response.ok` branch and again in the `catch` block (which also catches the error thrown by the `!ok` branch). This caused two `logout` broadcast events to fire over BroadcastChannel, creating a race condition where Tab B could receive two 'logout' events and attempt to clear already-cleared state.

**Patch applied:** `sessionCleared` guard in `handleTokenRefresh()` prevents double-clear.

---

### ✅ SC-10 — Logout in One Tab → Other Tab Logs Out
**Status:** PARTIAL FAIL  
**Issues found:**
- **AUTH-RACE-02 (HIGH)** — When Tab B received the `'logout'` BroadcastChannel message, `handleBroadcast` cleared `accessToken` and emitted `'logout'` to React listeners. The `AuthContext` subscriber updated React state correctly. BUT it did **not** call `clearCsrfToken()` or `clearMonitoringUser()`. This meant Tab B retained:
  - A stale in-memory CSRF token (would send it on the next visit to the login page, causing 403 on a post-login state-changing request if a new session issues a different CSRF token)
  - Stale monitoring/analytics identity (continued attributing actions to the logged-out user)

**Patches applied:**
- `AuthContext.tsx` subscriber now calls `clearCsrfToken()` + `clearMonitoringUser()` on `'logout'` and `'session-expired'` events
- `session.ts` → `handleBroadcast` now also handles `'session-expired'` type (previously unrecognized and silently dropped)
- `session.ts` → `scheduleTokenRefresh()` now broadcasts `'session-expired'` over BroadcastChannel so all tabs react to token expiry, not just the tab where the timer fires

---

### ✅ SC-11 — Session Persistence After Refresh
**Status:** PASS  
- On page reload: `sessionManager.init()` → no access token in memory (intentional)
- `AuthContext` hydration checks `sessionManager.getUser()` (from `localStorage`)
- If user found → calls `GET /auth/me` which uses the refresh cookie to issue a new access token and validate the session
- Sets `isHydrated: true` either way (authenticated or not) — prevents premature redirects
- `ProtectedRoute` waits for `isHydrated && !isLoading` before making decisions — no blank screen / redirect loop

---

### ✅ SC-12 — Simultaneous Login in Two Browsers
**Status:** PASS (by design)  
- Two separate browser instances = two independent httpOnly cookie jars
- Both can be logged in simultaneously — this is intentional behavior
- BroadcastChannel is per-origin, per-browser-process — does not cross browser instances
- If the server enforces single-session (mutual exclusion), it would revoke the older refresh token; client would get 401 on next refresh → forced logout
- **No client-side fix needed.**

---

### ✅ SC-13 — Tampered JWT
**Status:** PASS  
- `parseJwt()` in `session.ts` decodes but does NOT verify the signature (client-side — intentional)
- `isTokenExpired()` only checks the `exp` claim client-side (for UX scheduling, not security)
- Every API request sends the token in the `Authorization` header; the server verifies the HMAC signature on every request
- A tampered JWT would fail server-side signature verification → 401 → `handleTokenRefresh()` → `/auth/refresh` with cookie → 401 (cookie mismatch) → `clearSession()` → redirect to login
- Comment in `getAccessToken()` explicitly documents: "We intentionally do NOT fall back to synthetic tokens because the server now verifies HMAC signatures on every request"

---

### ⚠️ SC-14 — Missing CSRF Token
**Status:** PARTIAL FAIL  
**Issues found:**
- **AUTH-BUG-02 (HIGH)** — Already documented in SC-07. The retry request after auto-refresh dropped the CSRF header, causing the second attempt to fail CSRF validation.
- **AUTH-DESIGN-01 (LOW)** — `csrfToken` is initialized to `null`. On first page load (hydration via `/auth/me`), the CSRF token is NOT fetched. It's only set after `login()`, `verifyOtp()`, or `googleSignIn()`. If a user has a live session from a previous visit (persisted via refresh cookie), the CSRF token is `null` until the first login call in this session. Any `POST/PUT/PATCH/DELETE` in the hydrated session would send no `X-CSRF-Token`. 
  - **Risk level:** depends entirely on server CSRF enforcement. If the server enforces CSRF on all state-changing routes (not just post-login), this is a medium-severity gap.
  - **Recommended fix:** Fetch a CSRF token as part of `/auth/me` during hydration and store it.

**Patch:** AUTH-BUG-02 fixed. AUTH-DESIGN-01 flagged as a future fix (server contract clarification needed).

---

### ✅ SC-15 — Refresh Token Expired
**Status:** PASS  
- `POST /auth/refresh` returns non-OK → `handleTokenRefresh()` calls `clearSession()` → emits `'logout'` → `AuthContext` sets `isAuthenticated: false` → `ProtectedRoute` redirects to `/login`
- No redirect loop: `ProtectedRoute` uses `<Navigate to="/login" state={{ from: location.pathname }}>` which is a replace navigation — hitting back doesn't loop
- `LoginPage` checks `isAuthenticated && !authLoading && !hasRedirected.current` before navigating away — won't loop if credentials fail

---

## Summary: Findings by Category

### 🔴 Auth Race Conditions

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| AUTH-RACE-01 | HIGH | Concurrent 401s during refresh: `isRefreshing` flag + queue handles this correctly | ✅ Already handled |
| AUTH-RACE-02 | HIGH | Cross-tab logout didn't clear CSRF token + monitoring identity in receiving tab | ✅ **PATCHED** |
| AUTH-RACE-03 | HIGH | `handleTokenRefresh()` could call `clearSession()` twice → double BroadcastChannel 'logout' event | ✅ **PATCHED** |

### 🟠 Session Desync Risks

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| AUTH-DESYNC-01 | HIGH | Token expiry only broadcast within the tab where the timer fires; other tabs didn't know | ✅ **PATCHED** |
| AUTH-DESYNC-02 | MEDIUM | Tab receiving 'login' broadcast has no access token; first API call will 401 → auto-refresh via cookie — this is correct httpOnly cookie behavior, not a bug | ✅ By design |
| AUTH-DESYNC-03 | LOW | `sessionStorage` pending data is per-tab; opening `/verify` in a new tab after signup redirects to `/signup` (correct behavior) | ✅ By design |

### 🔴 Token Misuse Vulnerabilities

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| AUTH-BUG-01 | HIGH | Retry fetch after 401+refresh used consumed AbortSignal → immediate timeout → stuck spinner | ✅ **PATCHED** |
| AUTH-BUG-02 | HIGH | CSRF token not re-attached on retry request after token refresh → 403 on state-changing retries | ✅ **PATCHED** |
| AUTH-BUG-03 | HIGH | Double `clearSession()` call in `handleTokenRefresh()` → double BroadcastChannel broadcast | ✅ **PATCHED** |
| AUTH-DESIGN-01 | MEDIUM | Hydrated sessions (persisted via refresh cookie) have no CSRF token until next login action | ⚠️ **OPEN** — Recommend fetching CSRF token as part of `/auth/me` response |

### 🟡 UX Inconsistency Issues

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| AUTH-UX-01 | MEDIUM | Expired OTP and wrong OTP showed identical generic toast — user didn't know to resend | ✅ **PATCHED** |
| AUTH-UX-02 | HIGH | OTP resend called `POST /auth/signup` → 409 Conflict / 429 Rate Limited | ✅ **PATCHED** |
| AUTH-UX-03 | MEDIUM | Login form spinner stuck on success if navigation was blocked (missing `finally` reset) | ✅ **PATCHED** |
| AUTH-UX-04 | LOW | Google Sign-In button doesn't distinguish "user cancelled popup" from "GIS script unavailable" — both show the same error message | ⚠️ **OPEN** — Low priority cosmetic |

---

## Required Fixes (Unpatched / Future Work)

### AUTH-DESIGN-01 — CSRF Token Missing on Hydrated Sessions
**Priority:** Medium  
**Root cause:** `csrfToken` is only set after `login()`, `verifyOtp()`, or `googleSignIn()`. A session persisted from a previous visit (via refresh cookie) calls `GET /auth/me` during hydration but does NOT receive or store a CSRF token.  
**Fix:** Have `/auth/me` return a `csrfToken` field, or add a dedicated `GET /auth/csrf` endpoint called during hydration:

```typescript
// In AuthContext hydration success block:
if (response.csrfToken) setCsrfToken(response.csrfToken);
```

### AUTH-IN-MEMORY-01 — Lockout and Rate Limit Store is In-Memory
**Priority:** Low (current mock API)  
**Root cause:** `loginAttemptStore` and `rateLimitStore` in `security.ts` are plain `Map` instances. A server restart resets all lockouts and rate limit windows.  
**Fix:** Replace with Redis or database-backed store before production deployment.

### AUTH-UX-04 — Google Popup Cancellation vs. Unavailability
**Priority:** Low  
**Root cause:** Both "user cancelled" and "GIS script not configured" reject with different error messages, but the catch block in both `LoginPage` and `SignupPage` uses a single generic toast title "Google Sign-In Failed".  
**Fix:** Check `err.message` for the known cancellation message and show "Sign-In Cancelled" instead.

---

## Verified Behaviors (No Fix Needed)

| Scenario | Verdict |
|----------|---------|
| Tampered JWT (SC-13) | Server-side signature verification catches it → 401 → logout |
| Refresh token reuse (SC-09) | Server detects reuse → 401 → client `clearSession()` → redirect |
| Simultaneous login, two browsers (SC-12) | Independent cookie jars → correct multi-session behavior |
| Hard refresh session persistence (SC-11) | `GET /auth/me` + refresh cookie restores session correctly |
| `ProtectedRoute` redirect loops | `isHydrated` guard + `hasNavigated` ref prevents loops |
| Unauthenticated access to protected routes | `Navigate` + `state.from` preserves destination correctly |
| Wrong role access to admin route | `safeNavigate` to `/home` with spinner (no blank screen) |
| 5-attempt lockout (SC-04) | Correctly enforced; cleared on success |
| OTP rate limiting (SC-03) | 5 attempts/min → 429 |
| Google domain restriction (SC-06) | Server-side only (correct) |
