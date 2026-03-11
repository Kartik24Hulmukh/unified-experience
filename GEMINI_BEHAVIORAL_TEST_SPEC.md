# GEMINI 3.1 PRO — BEHAVIORAL TEST SPECIFICATION

**System:** Unified Experience (Berozgar Platform)  
**Agent Role:** Gemini 3.1 Pro as User-Behavior Simulation Agent  
**Date:** 2026-03-11  
**Classification:** PRODUCTION GATE — Do not publish until all phases PASS  

---

## TABLE OF CONTENTS

| Phase | Module | Priority |
|-------|--------|----------|
| 0 | [Global Prerequisites](#phase-0--global-prerequisites) | BLOCKING |
| 1 | [Authentication](#phase-1--authentication) | BLOCKING |
| 2 | [Resale Marketplace](#phase-2--resale-marketplace) | BLOCKING |
| 3 | [Accommodation](#phase-3--accommodation) | BLOCKING |
| 4 | [Academics](#phase-4--academics) | HIGH |
| 5 | [Essentials (Mess + Hospital)](#phase-5--essentials) | HIGH |
| 6 | [Profile](#phase-6--profile) | HIGH |
| 7 | [Admin](#phase-7--admin) | BLOCKING |
| 8 | [Chaos Testing](#phase-8--chaos-testing) | BLOCKING |
| 9 | [Multi-Tab & Refresh](#phase-9--multi-tab--refresh) | BLOCKING |
| 10 | [Performance & Memory](#phase-10--performance--memory) | HIGH |

---

## SYSTEM ARCHITECTURE REFERENCE

```
Frontend: React 18 + Vite + TanStack Query + Zustand-free (React Context)
Backend:  Fastify + Prisma (PostgreSQL) + HS256 JWT
Auth:     Access token (15min, in-memory) + Refresh token (7d, httpOnly cookie)
CSRF:     Double-submit cookie (_csrf) + X-CSRF-Token header
FSM:      Dual-validated — frontend ListingMachine/RequestMachine + backend equivalents
Session:  BroadcastChannel('berozgar-session') + localStorage fallback
```

### DATABASE ENUMS (Ground Truth)

```prisma
enum UserRole        { STUDENT | ADMIN }
enum PrivilegeLevel  { STANDARD | OBSERVER | REVIEWER | SUPER }
enum ListingStatus   { DRAFT | PENDING_REVIEW | APPROVED | REJECTED | INTEREST_RECEIVED | IN_TRANSACTION | COMPLETED | EXPIRED | FLAGGED | ARCHIVED | REMOVED }
enum RequestStatus   { IDLE | SENT | ACCEPTED | DECLINED | MEETING_SCHEDULED | COMPLETED | CANCELLED | EXPIRED | WITHDRAWN | DISPUTED | RESOLVED }
enum DisputeStatus   { OPEN | UNDER_REVIEW | RESOLVED | REJECTED | ESCALATED }
enum DisputeType     { FRAUD | ITEM_NOT_AS_DESCRIBED | NO_SHOW | OTHER }
```

### API BASE ROUTES

| Prefix | File | Auth |
|--------|------|------|
| `/api/auth/*` | `server/src/routes/auth.ts` | Public (mostly) |
| `/api/listings` | `server/src/routes/listings.ts` | Mixed |
| `/api/requests` | `server/src/routes/requests.ts` | Authenticated |
| `/api/admin/*` | `server/src/routes/admin.ts` | ADMIN role |
| `/api/profile` | `server/src/routes/profile.ts` | Authenticated |
| `/api/disputes` | `server/src/routes/disputes.ts` | Authenticated |

### RATE LIMITS

| Endpoint | Max | Window |
|----------|-----|--------|
| POST /api/auth/signup | 3 | 15 min |
| POST /api/auth/verify-otp | 5 | 15 min |
| POST /api/auth/login | 5 | 15 min |
| POST /api/auth/google | 10 | 15 min |
| POST /api/auth/refresh | 10 | 15 min |
| POST /api/listings | 10 | 60 min |
| POST /api/requests | 10 | 60 min |
| PATCH /api/requests/*/event | 20 | 60 min |
| POST /api/disputes | 5 | 60 min |
| Global default | 60 | 60 sec |

---

## PHASE 0 — GLOBAL PREREQUISITES

Before any module test, Gemini must validate these:

### 0.1 Server Health

```
ASSERT: GET /health → 200
ASSERT: Response includes { status: 'ok' }
ASSERT: Response time < 500ms
```

### 0.2 Database Connectivity

```
ASSERT: Server connects to PostgreSQL (check startup logs)
ASSERT: Prisma migrations are current (no pending migrations)
```

### 0.3 CORS Configuration

```
ASSERT: OPTIONS /api/auth/login returns correct Access-Control-Allow-Origin
ASSERT: Credentials: include works (cookies sent cross-origin in production)
```

### 0.4 CSRF Token Availability

```
ASSERT: GET /api/auth/csrf-token → 200
ASSERT: Response sets _csrf cookie (httpOnly: false, sameSite: strict)
ASSERT: Cookie value matches response body token
```

### 0.5 Static Asset Loading

```
ASSERT: GET / → 200 (index.html loads)
ASSERT: All JS bundles load (no 404 on chunk files)
ASSERT: No console errors on initial page load
ASSERT: Vite HMR not active in production build
```

---

## PHASE 1 — AUTHENTICATION

### Test 1.1 — Email Signup (Happy Path)

**Pre-conditions:**
- No user exists with test email `testuser@mctrgit.ac.in`
- Server email transport is configured (or mock is active)
- OTP table has no pending entries for this email

**Steps:**

| # | Action | Expected Response | DB Side-Effect |
|---|--------|------------------|----------------|
| 1 | Navigate to `/signup` | Page renders. No console errors. Form visible with: Full Name, Email, Password fields | — |
| 2 | Enter `fullName: "Test User"`, `email: "testuser@mctrgit.ac.in"`, `password: "SecurePass123!"` | Form validates client-side. No red borders | — |
| 3 | Click "Sign Up" | POST `/api/auth/signup` → 200. Response: `{ message: 'Verification code sent to your email' }` | `otps` row created: `{ email, code: 6-digit, expiresAt: now+10min, usedAt: null, attempts: 0 }` |
| 4 | UI transitions to OTP input screen | OTP input field visible. Timer visible (10 min). Resend button visible but disabled initially | — |
| 5 | Enter correct 6-digit OTP | — | — |
| 6 | Click "Verify" | POST `/api/auth/verify-otp` → 200. Response: `{ user: { id, email, role: 'student', verified: true }, accessToken: 'eyJ...' }` | User created: `{ role: STUDENT, trustStatus: 'GOOD_STANDING', verified: true, completedExchanges: 0, cancelledRequests: 0, adminFlags: 0 }`. OTP marked: `usedAt: now`. RefreshToken created (SHA-256 hash stored) |
| 7 | Redirect to `/home` | Home page renders. Nav shows authenticated state. User name visible | `refresh_token` cookie set (httpOnly, secure, sameSite: strict, path: /api/auth, maxAge: 7d) |

**Post-condition assertions:**

```
ASSERT: GET /api/auth/me → 200 with { user.email: 'testuser@mctrgit.ac.in', user.role: 'student' }
ASSERT: localStorage key 'berozgar_auth' contains user object (non-sensitive fields only)
ASSERT: sessionStorage key 'berozgar_pending' is CLEARED
ASSERT: Access token is NOT in localStorage (memory only)
ASSERT: document.cookie does NOT contain 'refresh_token' (httpOnly)
ASSERT: document.cookie CONTAINS '_csrf' (readable)
ASSERT: BroadcastChannel('berozgar-session') emitted 'login' event
```

**Red Flags (Fail immediately if):**
- [ ] User row created BEFORE OTP verification
- [ ] Redirect loop between `/signup` and `/home`
- [ ] OTP resend not working after cooldown
- [ ] Console errors during flow
- [ ] Password stored in localStorage or sessionStorage
- [ ] Access token stored in localStorage

### Test 1.2 — Email Signup (Edge Cases)

| # | Scenario | Action | Expected |
|---|----------|--------|----------|
| 1.2.1 | Invalid domain | Email: `user@gmail.com` | Rejection at server: 400 with domain error. No OTP sent |
| 1.2.2 | Duplicate email | Signup with existing email | Server handles gracefully. Either: "Account exists, please login" OR upsert behavior (no crash) |
| 1.2.3 | Expired OTP | Wait >10 min, then submit | 400/401 with expiry message. User can resend |
| 1.2.4 | Wrong OTP 5 times | Submit wrong OTP 5× | OTP burned (`attempts >= 5`). Must restart signup. Rate limit: 429 after 5 attempts/15min |
| 1.2.5 | OTP replay | Use same OTP twice after success | Second call fails (usedAt already set) |
| 1.2.6 | SQL injection in name | `fullName: "'; DROP TABLE users; --"` | Input sanitized. No SQL error. User created with literal string name |
| 1.2.7 | XSS in email field | `email: "<script>alert(1)</script>@mctrgit.ac.in"` | Rejected by email validation. No script execution |
| 1.2.8 | Empty fields | Submit with blank fields | Client-side validation blocks. No API call |
| 1.2.9 | Concurrent signups | Two tabs signup same email simultaneously | Only one succeeds. Prisma unique constraint prevents duplicate. No 500 error |

### Test 1.3 — Google OAuth (Happy Path)

**Pre-conditions:**
- Google OAuth client configured
- No user exists with Google-linked email (or user exists without `googleId`)

**Steps:**

| # | Action | Expected | DB Side-Effect |
|---|--------|----------|----------------|
| 1 | Navigate to `/login` | Login page renders with "Continue with Google" button | — |
| 2 | Click "Continue with Google" | Google consent screen opens (popup or redirect) | — |
| 3 | Authenticate with `@mctrgit.ac.in` Google account | POST `/api/auth/google` with `{ credential: <id_token> }` → 200 | User upserted: `{ googleId: <sub>, provider: GOOGLE, verified: true }`. RefreshToken created |
| 4 | Redirect to `/home` | Authenticated home page. User name from Google profile displayed | Cookies set same as email signup |

**Post-condition assertions:**

```
ASSERT: GET /api/auth/me → 200 with { user.provider: 'GOOGLE' }
ASSERT: No duplicate user rows (if email already existed from email signup)
ASSERT: googleId field is populated on user row
ASSERT: Any previous failedLoginAttempts are RESET to 0
ASSERT: lockedUntil is cleared (null)
```

### Test 1.4 — Google OAuth (Edge Cases)

| # | Scenario | Expected |
|---|----------|----------|
| 1.4.1 | Non-college Google account (`@gmail.com`) | Rejected: domain restriction enforced. No user created |
| 1.4.2 | Expired Google token | 401 with "Invalid credential" |
| 1.4.3 | Tampered Google token | 401 — signature verification fails |
| 1.4.4 | Existing email-only user signs in with Google | Accounts linked: `googleId` set on existing user. No duplicate |
| 1.4.5 | Google popup blocked | UI shows error message or retry button. No crash |

### Test 1.5 — Login (Email/Password)

**Pre-conditions:**
- User exists with verified email and password

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/login` | Login form renders |
| 2 | Enter valid credentials | — |
| 3 | Submit | POST `/api/auth/login` → 200. Access token + refresh cookie set. Redirect to `/home` |

**Edge Cases:**

| # | Scenario | Expected |
|---|----------|----------|
| 1.5.1 | Wrong password | 401 "Invalid credentials". `failedLoginAttempts++` |
| 1.5.2 | 5 wrong passwords | Account locked: `lockedUntil = now + 15min`. Response: 403 with lockout message |
| 1.5.3 | Login while locked | 403 with remaining lockout time |
| 1.5.4 | Login after lockout expires | Success. `failedLoginAttempts` reset to 0 |
| 1.5.5 | Google-only user tries password login | 401 or "Please use Google sign-in" |

### Test 1.6 — Logout

**Pre-conditions:**
- User authenticated with valid session

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Click logout button | POST `/api/auth/logout` → 200 |
| 2 | — | `refresh_token` cookie cleared (maxAge: 0) |
| 3 | — | localStorage `berozgar_auth` cleared |
| 4 | — | In-memory access token nullified |
| 5 | — | BroadcastChannel emits `'logout'` event |
| 6 | Navigate to `/home` | Redirect to `/login` (ProtectedRoute enforcement) |

**Multi-tab assertions:**

```
ASSERT: Tab 2 (open to /resale) receives BroadcastChannel 'logout' event
ASSERT: Tab 2 redirects to /login within 2 seconds
ASSERT: Tab 2 cannot call protected APIs (401 on any attempt)
ASSERT: Opening new tab → /home redirects to /login
```

### Test 1.7 — Token Refresh Lifecycle

**Pre-conditions:**
- User authenticated. Access token will expire in <60 seconds.

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Wait for auto-refresh trigger (~60s before expiry + jitter) | Session manager fires `token-refresh` event |
| 2 | — | POST `/api/auth/refresh` sent with `credentials: include` (httpOnly cookie) |
| 3 | — | Response: 200 with `{ accessToken: 'new_eyJ...' }`. New `refresh_token` cookie set |
| 4 | — | Old refresh token hash marked as `revokedAt: now` with `replacedByToken: new_hash` |
| 5 | — | BroadcastChannel emits `'login'` event (other tabs pick up new token) |
| 6 | Continue browsing | All subsequent API calls use new access token. No interruption |

**Edge Cases:**

| # | Scenario | Expected |
|---|----------|----------|
| 1.7.1 | Expired refresh token (>7 days) | `/refresh` → 401. User logged out. Redirect to `/login` |
| 1.7.2 | Revoked refresh token (used twice) | `/refresh` → 401. Possible token theft detection |
| 1.7.3 | Concurrent refresh from 2 tabs | Only first succeeds. Second gets 401 (old token revoked). Second tab re-syncs via BroadcastChannel |
| 1.7.4 | Max 5 tokens per user | 6th login revokes oldest token. No crash |
| 1.7.5 | Network failure during refresh | Retry after backoff. If all retries fail → logout |

### Test 1.8 — CSRF Protection

| # | Scenario | Expected |
|---|----------|----------|
| 1.8.1 | POST /api/listings without X-CSRF-Token header | 403 `CSRF_INVALID` (when CSRF_ENFORCE=true) |
| 1.8.2 | POST /api/listings with mismatched CSRF token | 403 `CSRF_INVALID` |
| 1.8.3 | POST /api/listings with valid CSRF token | Request proceeds normally |
| 1.8.4 | CSRF token expired/rotated | Client auto-recovers: fetches fresh token from `/auth/csrf-token`, retries mutation |
| 1.8.5 | Auth routes exempt from CSRF | POST `/api/auth/login` works without CSRF header |

---

## PHASE 2 — RESALE MARKETPLACE

### Test 2.1 — Listing Creation (Happy Path)

**Pre-conditions:**
- User authenticated as STUDENT
- User trust = `GOOD_STANDING` (not restricted)
- User has not exceeded rate limit (10 listings/60min)

**Steps:**

| # | Action | Expected API | Expected UI | DB Side-Effect |
|---|--------|-------------|-------------|----------------|
| 1 | Navigate to `/resale` | GET `/api/listings?module=resale` → 200 | Grid renders with existing listings. GSAP animations fire | — |
| 2 | Click "Create Listing" | — | Modal opens with GSAP clip-path animation. Step 1 visible: Title, Category dropdown, Price, Description | — |
| 3 | Fill Step 1: `title: "TI-84 Calculator"`, `category: "calculators"`, `price: 1500`, `description: "Barely used, perfect for engineering math"` | — | Client validation passes. "Next" button enabled | — |
| 4 | Click "Next" → Step 2 | — | Image upload area visible. JPEG/PNG/WebP accepted. Max 5MB indicator shown | — |
| 5 | Upload 1 image | — | Image preview renders. Upload progress shown | — |
| 6 | Click "Next" → Step 3 (Consent) | — | Privacy protocol consent checkbox visible | — |
| 7 | Check consent → Click "Submit" | POST `/api/listings` with `{ title, category, module: 'resale', price, description }` + `X-Idempotency-Key` header → 201 | Success toast. Modal closes with exit animation. Grid refetches. New listing visible in grid | `listings` row: `{ status: DRAFT→PENDING_REVIEW, ownerId: user.id }`. Idempotency key cached (24h). Fraud heuristic evaluated (fire-and-forget) |

**Post-condition assertions:**

```
ASSERT: GET /api/listings?module=resale includes new listing with status 'PENDING_REVIEW'
ASSERT: Listing visible in "My Listings" filter
ASSERT: Listing NOT visible to other users (PENDING_REVIEW is not public)
ASSERT: X-Idempotency-Key header was sent
ASSERT: Idempotency sentinel exists in cache with status != 102
ASSERT: AuditLog row: { action: 'LISTING_CREATED', entityType: 'Listing', entityId: <new_id> }
ASSERT: No console errors during form submission
ASSERT: Modal GSAP timeline cleaned up (no orphaned contexts)
```

### Test 2.2 — Listing Creation (Failure Injection)

| # | Scenario | Action | Expected | Red Flag If |
|---|----------|--------|----------|-------------|
| 2.2.1 | Double-click submit | Click submit twice rapidly | `isSubmittingRef.current` blocks second click. Only 1 API call. If race: idempotency returns cached 201 | Two listing rows created |
| 2.2.2 | Step skipping | Try to navigate directly to Step 3 | Form enforces sequential progression. Step 3 unreachable without Step 1+2 | Consent submitted without filling details |
| 2.2.3 | Network retry | Submit → network timeout → auto-retry | Same idempotency key → server returns cached response. No duplicate | Two listings in DB |
| 2.2.4 | Restricted user | User with `trustStatus: RESTRICTED` clicks create | `canPerform('CREATE_LISTING')` returns false. UI blocks action. Toast: "Account restricted" | Listing created for restricted user |
| 2.2.5 | Rate limit hit | Create 11 listings in 60 min | 11th attempt → 429 `RATE_LIMIT_EXCEEDED` with `retryAfter` | 500 error instead of 429 |
| 2.2.6 | Oversized image | Upload 10MB image | Client rejects (max 5MB). No API call | Server processes 10MB file |
| 2.2.7 | Invalid file type | Upload .exe file | Client rejects (JPEG/PNG/WebP only) | Server accepts non-image |
| 2.2.8 | Empty required fields | Submit with blank title | Client validation blocks. Red border on title field | API call with empty title |
| 2.2.9 | Price = 0 or negative | Enter price: -100 | Client validation rejects OR server validation catches | Listing with negative price in DB |
| 2.2.10 | XSS in title | `title: "<img src=x onerror=alert(1)>"` | Stored safely. Rendered escaped in grid. No script execution | Alert popup in any user's browser |

### Test 2.3 — Admin Moderation (Happy Path)

**Pre-conditions:**
- Admin user logged in (role: ADMIN, privilegeLevel: REVIEWER or SUPER)
- At least one listing with `status: PENDING_REVIEW` exists

**Steps:**

| # | Action | Expected API | Expected UI | DB Side-Effect |
|---|--------|-------------|-------------|----------------|
| 1 | Navigate to `/admin` | GET `/api/admin/pending` → 200 | Admin dashboard renders. "Pending" tab shows listing table | — |
| 2 | Click listing row to expand details | — | Detail dialog shows: title, description, price, category, owner email, created date | — |
| 3 | Click "Approve" | PATCH `/api/listings/<id>/status` with `{ status: 'approved' }` → 200 | Success toast. Listing removed from pending table. Stats update | `listings.status: PENDING_REVIEW → APPROVED`. AuditLog: `{ actorId: admin.id, action: 'LISTING_STATUS_UPDATE', entityType: 'Listing', entityId: <id>, actorRole: 'ADMIN', metadata: { from: 'PENDING_REVIEW', to: 'APPROVED' } }` |
| 4 | — | — | — | Listing now visible in public GET `/api/listings` |

**Post-condition assertions:**

```
ASSERT: FSM transition validated server-side (PENDING_REVIEW + APPROVE → APPROVED)
ASSERT: AuditLog row exists with correct actorId, action, entityId
ASSERT: GET /api/admin/stats shows pendingListings decremented by 1
ASSERT: Public listing query now includes this listing
ASSERT: Non-admin user can see listing on /resale
```

### Test 2.4 — Admin Moderation (Edge Cases)

| # | Scenario | Expected |
|---|----------|----------|
| 2.4.1 | Approve already-approved listing | FSM rejects: `machine.can('APPROVE')` returns false for state `APPROVED`. 400/409 error |
| 2.4.2 | Student tries to approve | `authorize('ADMIN')` middleware blocks. 403 Forbidden |
| 2.4.3 | OBSERVER admin tries to approve | Depends on middleware. Should be blocked (OBSERVER = read-only) |
| 2.4.4 | Reject listing | PATCH with `{ status: 'rejected' }` → FSM: PENDING_REVIEW + REJECT → REJECTED. Audit logged |
| 2.4.5 | Flag listing | PATCH with `{ status: 'flagged' }` → FSM: APPROVED + FLAG → FLAGGED. All non-terminal requests force-cancelled with audit: `REQUESTS_FORCE_CANCELLED` |
| 2.4.6 | Concurrent approve by 2 admins | Row-level lock (`FOR UPDATE`) serializes. First succeeds, second fails (FSM invalid from APPROVED state) |

### Test 2.5 — Buyer Request Exchange (Happy Path)

**Pre-conditions:**
- Listing exists with `status: APPROVED`
- Different user (buyer) is logged in
- Buyer trust = `GOOD_STANDING`

**Steps:**

| # | Action | Expected API | DB Side-Effect |
|---|--------|-------------|----------------|
| 1 | Navigate to listing detail | GET `/api/listings/<id>` → 200 | — |
| 2 | Click "Request Exchange" | POST `/api/requests` with `{ listingId }` → 201 | **Atomic CAS**: `listing.status: APPROVED → INTEREST_RECEIVED` (via `updateMany WHERE status='APPROVED'`). `requests` row: `{ buyerId, sellerId: listing.ownerId, status: SENT, version: 0 }`. AuditLog: `REQUEST_CREATE` |
| 3 | — | — | Seller should see notification (if implemented) |

**Post-condition assertions:**

```
ASSERT: GET /api/requests (buyer view) includes request with status 'SENT'
ASSERT: GET /api/requests (seller view) includes same request
ASSERT: Listing status is now 'INTEREST_RECEIVED'
ASSERT: Second buyer attempting same listing → CAS fails → 409 Conflict
ASSERT: Same buyer re-requesting same listing → Application check blocks → 409
```

### Test 2.6 — Buyer Request (Failure Injection)

| # | Scenario | Action | Expected | Red Flag If |
|---|----------|--------|----------|-------------|
| 2.6.1 | Double request | Click "Request Exchange" twice rapidly | First succeeds. Second blocked by CAS lock (listing already INTEREST_RECEIVED) or idempotency | Two request rows for same listing+buyer |
| 2.6.2 | Two buyers race | Buyer A and B click simultaneously | Atomic CAS: one wins (`updateMany` returns `count: 1`), other gets 409 | Both succeed → listing has 2 active requests |
| 2.6.3 | Request own listing | Buyer = listing owner | Server rejects: "Cannot request your own listing" | Self-exchange created |
| 2.6.4 | Request non-APPROVED listing | Listing is DRAFT/PENDING_REVIEW | 400/409: listing not in requestable state | Request created for non-approved listing |
| 2.6.5 | Restricted buyer | Buyer is RESTRICTED | `canPerform('REQUEST_EXCHANGE')` blocks. 403 | Request created for restricted user |

### Test 2.7 — Exchange Lifecycle (Full Happy Path)

**Pre-conditions:**
- Request exists with `status: SENT`
- Listing is `INTEREST_RECEIVED`

**Steps:**

| # | Actor | Action | Event | Request Status | Listing Status | DB Side-Effect |
|---|-------|--------|-------|---------------|----------------|----------------|
| 1 | Seller | Accept request | `ACCEPT` | SENT → ACCEPTED | INTEREST_RECEIVED → IN_TRANSACTION | AuditLog: `REQUEST_EVENT { event: 'ACCEPT' }` |
| 2 | Either | Schedule meeting | `SCHEDULE` | ACCEPTED → MEETING_SCHEDULED | IN_TRANSACTION (unchanged) | AuditLog |
| 3 | Buyer | Confirm exchange | `CONFIRM` | MEETING_SCHEDULED → COMPLETED | IN_TRANSACTION → COMPLETED | `buyer.completedExchanges++`, `seller.completedExchanges++`. Trust recalculated. AuditLog |

**Post-condition assertions (after CONFIRM):**

```
ASSERT: Request.status = 'COMPLETED'
ASSERT: Listing.status = 'COMPLETED'
ASSERT: buyer.completedExchanges incremented by 1
ASSERT: seller.completedExchanges incremented by 1
ASSERT: GET /api/profile (buyer) shows updated exchangesCompleted
ASSERT: GET /api/profile (seller) shows updated exchangesCompleted
ASSERT: Trust engine re-evaluated for both users
ASSERT: No other active requests exist for this listing
ASSERT: Listing no longer appears in public browse
```

### Test 2.8 — Exchange Lifecycle (Failure Injection)

| # | Scenario | Action | Expected | Red Flag If |
|---|----------|--------|----------|-------------|
| 2.8.1 | Confirm before Accept | Buyer sends CONFIRM on SENT request | FSM rejects: `machine.can('CONFIRM')` false for state SENT. 400 error | Status jumps to COMPLETED |
| 2.8.2 | Double Accept | Seller clicks Accept twice | First succeeds. Second fails: optimistic locking (`version` mismatch) or FSM invalid (ACCEPTED + ACCEPT) | Version not incremented |
| 2.8.3 | Buyer tries Accept | Buyer sends ACCEPT event | Authorization check: ACCEPT ∈ SELLER_ONLY_EVENTS. 403 Forbidden | Buyer can accept own request |
| 2.8.4 | Seller tries Confirm | Seller sends CONFIRM event | Authorization check: CONFIRM ∈ BUYER_ONLY_EVENTS. 403 | Seller self-confirms |
| 2.8.5 | Cancel after Schedule | Either party cancels | Request: MEETING_SCHEDULED → CANCELLED. Actor's `cancelledRequests++`. If no other active requests, listing → APPROVED | Listing stuck in IN_TRANSACTION |
| 2.8.6 | Refresh mid-Accept | Seller accepts, immediately refresh page | Optimistic update rolled back on refetch. Server state is source of truth. UI syncs correctly | UI shows ACCEPTED but server shows SENT |
| 2.8.7 | 3 tabs open | Open listing in 3 tabs. Accept in tab 1 | Tab 2 and 3 should reflect updated status on next query invalidation or BroadcastChannel sync | Tabs show inconsistent states permanently |
| 2.8.8 | Stale version | Send event with `version: 0` when DB has `version: 3` | Optimistic lock conflict. 409 with "Please refresh" | Stale write succeeds |
| 2.8.9 | Dispute after completion | Buyer raises dispute post-COMPLETED | Request: COMPLETED → DISPUTED. Dispute row created with `status: OPEN` | Dispute blocked after completion |

### Test 2.9 — Optimistic Update Consistency

**Specific test for TanStack Query optimistic updates:**

| # | Scenario | Validate |
|---|----------|----------|
| 2.9.1 | Successful optimistic update | Status changes instantly in UI before server responds. After server 200, cache invalidated and re-fetched. Final UI matches server |
| 2.9.2 | Failed optimistic update (server rejects) | Status changes instantly. Server returns 400/409. `onError` fires: cache rolled back to `previousRequests` snapshot. UI reverts to pre-mutation state |
| 2.9.3 | Network error during mutation | Optimistic update shows. Network error. Rollback fires. UI reverts. Error toast shown |
| 2.9.4 | List + Detail cache consistency | After event, both `queryKeys.requests.all` and `queryKeys.requests.detail(id)` reflect same status |

---

## PHASE 3 — ACCOMMODATION

### Test 3.1 — Listing Creation (Happy Path)

**Pre-conditions:**
- User authenticated as STUDENT, GOOD_STANDING
- Module = accommodation

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/accommodation` | Page renders: hero section with glitch text, area cards (Near Campus, City Center, Outer Ring), listing grid. GSAP parallax animations fire |
| 2 | Click "Create Listing" | Modal opens (same `ResourceListingForm` with `moduleName: 'accommodation'`) |
| 3 | Fill details: `title: "2BHK Near Campus"`, `category: "Accommodation"`, `price: 8000`, `description: "Fully furnished, 5 min walk"` | Client validation passes |
| 4 | Complete image upload + consent | — |
| 5 | Submit | POST `/api/listings` with `{ module: 'accommodation', ... }` → 201 |

**Post-condition assertions:**

```
ASSERT: Listing created with module='accommodation'
ASSERT: Owner email NOT exposed in GET /api/listings response (CRIT-F / HIGH-3 fix)
ASSERT: Listing goes through same PENDING_REVIEW → ADMIN_APPROVE → APPROVED flow
```

### Test 3.2 — Contact Request Flow

**Pre-conditions:**
- Approved accommodation listing exists
- Different user (renter) logged in

**Steps:**

| # | Action | Expected | DB Side-Effect |
|---|--------|----------|----------------|
| 1 | View listing detail | Owner email/phone NOT visible. Only: title, description, price, area, images | — |
| 2 | Click "Request Contact" | POST `/api/requests` → 201. Request status: SENT | Request row created. Listing → INTEREST_RECEIVED |
| 3 | (Seller view) Accept contact request | PATCH `/api/requests/<id>/event` with `{ event: 'ACCEPT' }` → 200 | Request: SENT → ACCEPTED |
| 4 | (Renter view) Reload request detail | Contact info NOW visible (owner email included in response) | — |

**Privacy assertions (CRITICAL):**

```
ASSERT: Before ACCEPT: GET /api/requests/<id> (renter view) does NOT include seller email/phone
ASSERT: Before ACCEPT: GET /api/listings/<id> does NOT include owner email
ASSERT: After ACCEPT:  GET /api/requests/<id> includes seller contact info
ASSERT: Other users (not buyer/seller) NEVER see contact info
ASSERT: API inspection (curl with auth token of random user) returns NO contact data
ASSERT: Admin CAN see contact info (for moderation)
```

**Red Flags (PUBLISH BLOCKER):**
- [ ] Contact visible via API before ACCEPT (inspect network tab)
- [ ] Contact visible to non-party users via direct API call
- [ ] Owner email in listing grid response
- [ ] Contact data in browser localStorage/sessionStorage

### Test 3.3 — Accommodation (Edge Cases)

| # | Scenario | Expected |
|---|----------|----------|
| 3.3.1 | Multiple contact requests on same listing | CAS lock prevents simultaneous. One wins, other gets 409 |
| 3.3.2 | Request already accepted, third party tries | Listing in INTEREST_RECEIVED. Third request blocked |
| 3.3.3 | Seller declines contact | Request → DECLINED. Listing may revert to APPROVED (if no other active requests) |
| 3.3.4 | Timeout before response | Stale recovery job (14 days) expires the SENT request |

---

## PHASE 4 — ACADEMICS

### Test 4.1 — Browse Flow

**Pre-conditions:**
- User authenticated (any role)

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/academics` | Page renders: hero section, 5 branch buttons (CSE, ECE, ME, CE, EE), resource type cards (Syllabus, Question Banks, Notes, Exam Patterns). GSAP animations fire |
| 2 | Click branch "CSE" | Filter updates. API call: `GET /api/listings?module=academics&search=CSE` or client-side filter |
| 3 | Click resource type "Notes" | Further filtering. Only Notes-category resources shown |
| 4 | Click a resource card | Detail view or expanded card shows: title, description, price, uploader info |

**Assertions:**

```
ASSERT: No infinite loading spinners
ASSERT: Empty state shown if no resources match filter
ASSERT: Filter combination works (branch + type + search)
ASSERT: Back navigation returns to filtered state
ASSERT: GSAP animations don't freeze on rapid filter changes
ASSERT: No console errors
```

### Test 4.2 — Resource Upload

**Pre-conditions:**
- User authenticated as STUDENT, GOOD_STANDING
- Upload feature enabled

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Click "Upload Resource" | `ResourceListingForm` modal opens with `moduleName: 'academics'` |
| 2 | Fill: `title: "CSE Sem 5 Notes"`, `category: "Notes"`, `price: 0` (free), `description: "Complete set of Operating Systems notes"` | Validation passes |
| 3 | Upload image → consent → submit | POST `/api/listings` with `{ module: 'academics', category: 'Notes', ... }` → 201 |
| 4 | Listing appears in academics grid after admin approval | Same moderation flow as resale |

**Assertions:**

```
ASSERT: Listing has module='academics'
ASSERT: Category is valid (Syllabus | Question Banks | Notes | Exam Patterns)
ASSERT: Moderation flow identical to resale (DRAFT/PENDING_REVIEW → APPROVED)
ASSERT: Free resources (price=0) are valid
```

---

## PHASE 5 — ESSENTIALS

### Test 5.1 — Navigation Flow

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/essentials` | Hub page renders: quick-links bar (Ambulance: 102, Emergency: 112), 2 module cards (Mess, Hospital), essential tips section, scrolling word marquee |
| 2 | Click "Mess" card | Navigate to `/mess` page |
| 3 | `/mess` page | Hero banner renders. Mess service cards visible (18+ services). Filters: Category, Price, Rating. FAQ section. No blank areas |
| 4 | Navigate back to `/essentials` | Hub page re-renders. No stale state |
| 5 | Click "Hospital" card | Navigate to `/hospital` page |
| 6 | `/hospital` page | Hospital cards visible (11+ facilities). Emergency indicators (24/7). Distance from campus shown. Quick emergency numbers highlighted |

**Assertions:**

```
ASSERT: /essentials → No blank page
ASSERT: /mess → No blank page. All 18+ mess cards render
ASSERT: /hospital → No blank page. All 11+ hospital cards render
ASSERT: No animation freeze on any page
ASSERT: No console errors on any page
ASSERT: GSAP hero image parallax works on /essentials
ASSERT: Scrolling word marquee animates correctly
ASSERT: Quick-links (Ambulance: 102, Emergency: 112) are clickable/functional
```

### Test 5.2 — Listing Interaction

| # | Action | Expected |
|---|--------|----------|
| 1 | Click a mess service card | Detail view expands or navigates. Shows: name, price, type (Veg/Non-Veg), hours, rating, contact |
| 2 | Return to grid | Grid intact. No layout shift |
| 3 | Click a hospital card | Detail shows: name, location, distance, contact, services, hours, emergency status, Google Maps link |
| 4 | Click Google Maps link | Opens in new tab (target="_blank"). No navigation away from app |
| 5 | Rapid navigation: /mess → /hospital → /essentials → /mess | All pages render correctly. No memory leak. No animation artifact |

**Memory leak check:**

```
ASSERT: After 10 rapid navigations, browser heap delta < 5MB
ASSERT: No orphaned GSAP ScrollTrigger instances
ASSERT: No orphaned event listeners accumulating
ASSERT: Performance.getEntriesByType('resource') shows no duplicate asset loads
```

---

## PHASE 6 — PROFILE

### Test 6.1 — Student Profile

**Pre-conditions:**
- User authenticated as STUDENT
- User has: 3 listings, 2 completed exchanges, 1 cancelled request, 0 disputes, 0 admin flags

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/profile` | GET `/api/profile` → 200. Profile page renders |
| 2 | Verify header | User name, email, verified badge, join date visible |
| 3 | Verify trust badge | Green badge: "✓ Good Standing" (`border-emerald-500 text-emerald-400`) |
| 4 | Verify Activity Summary | 4 stat cards: Listings (3), Requests (count), Exchanges Completed (2), Value Circulated (₹ sum) |
| 5 | Verify Contributions | Reputation Score progress bar (calculated: `min(100, 2*20 + accountAgeDays)`), Active Listings count |
| 6 | Verify Requests Inbox | Active requests section + History section |

**Assertions:**

```
ASSERT: Listings count matches actual DB count for user
ASSERT: Exchanges Completed matches user.completedExchanges
ASSERT: Value Circulated = SUM(price) of completed-exchange listings
ASSERT: Trust badge color matches trustStatus
ASSERT: Reputation score formula: min(100, completedExchanges * 20 + accountAgeDays)
```

### Test 6.2 — Profile Updates After Exchange

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Complete a new exchange (Phase 2 lifecycle) | — |
| 2 | Navigate to `/profile` (or refresh) | GET `/api/profile` → 200 |
| 3 | Verify updated metrics | Exchanges Completed incremented. Value Circulated increased. Reputation score recalculated |

**Assertion:**

```
ASSERT: Profile metrics reflect the just-completed exchange
ASSERT: No stale cache (TanStack Query invalidated profile on exchange completion)
```

### Test 6.3 — Trust Badge Transitions

| Scenario | State | Badge | Color |
|----------|-------|-------|-------|
| Clean user | `GOOD_STANDING` | "✓ Good Standing" | `emerald-500` (green) |
| 3+ cancellations | `REVIEW_REQUIRED` | "⚠ Under Review" | `yellow-500` |
| 2+ disputes | `REVIEW_REQUIRED` | "⚠ Under Review" | `yellow-500` |
| 1+ admin flags | `RESTRICTED` | "🔒 Restricted" | `red-500` |
| New account, high cancel ratio | `REVIEW_REQUIRED` | "⚠ Under Review" | `yellow-500` |

**Test each transition:**

```
ASSERT: Cancel 3 requests → refresh profile → badge changes to yellow
ASSERT: Admin flags user → refresh profile → badge changes to red
ASSERT: Admin resolves flag → refresh profile → badge reverts (if thresholds clear)
```

### Test 6.4 — Admin Profile

**Pre-conditions:**
- Admin user logged in

**SUPER/REVIEWER Tier:**

| # | Element | Expected |
|---|---------|----------|
| 1 | Governance Metrics | 4 cards: Total Listings, Active Users, Open Disputes, Avg Approval Time (with delta indicators) |
| 2 | System Health | Health score (0-100), Recent actions count (24h) |
| 3 | Dispute dashboard | Accessible |
| 4 | User drilldown | Accessible |

**OBSERVER Tier:**

| # | Element | Expected |
|---|---------|----------|
| 1 | System Overview | `READ-ONLY` badge visible. 4 stats: Total Students, Active Exchanges, Academic Listings, System Uptime |
| 2 | Academic Registry | Informational only (textbooks listed, active exchanges) |
| 3 | Admin actions | All action buttons hidden or disabled |

**Assertions:**

```
ASSERT: OBSERVER cannot see approve/reject/flag buttons
ASSERT: OBSERVER cannot access /api/admin/recovery
ASSERT: SUPER/REVIEWER see all governance controls
ASSERT: Stats numbers match GET /api/admin/stats response
```

---

## PHASE 7 — ADMIN

### Test 7.1 — Stats Dashboard

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/admin` | GET `/api/admin/stats` → 200 |
| 2 | Verify stats | 6 metrics: totalUsers, totalListings, pendingListings, activeDisputes, totalRequests, completedExchanges |

**DB Reality Check:**

```
ASSERT: stats.totalUsers == SELECT COUNT(*) FROM users
ASSERT: stats.totalListings == SELECT COUNT(*) FROM listings
ASSERT: stats.pendingListings == SELECT COUNT(*) FROM listings WHERE status='PENDING_REVIEW'
ASSERT: stats.activeDisputes == SELECT COUNT(*) FROM disputes WHERE status IN ('OPEN', 'UNDER_REVIEW')
ASSERT: stats.totalRequests == SELECT COUNT(*) FROM requests
ASSERT: stats.completedExchanges == SELECT COUNT(*) FROM requests WHERE status='COMPLETED'
```

**Red Flag:** Stats numbers don't match direct DB queries.

### Test 7.2 — Audit Trail

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Perform listing approval (Phase 2.3) | — |
| 2 | Navigate to Audit Log tab | GET `/api/admin/audit?page=1&limit=50` → 200 |
| 3 | Find approval entry | Row with: `action: 'LISTING_STATUS_UPDATE'`, `entityType: 'Listing'`, `entityId: <listing_id>`, `actorId: <admin_id>`, `actorRole: 'ADMIN'` |

**Assertions:**

```
ASSERT: Every admin action creates an audit log entry
ASSERT: Audit log is paginated (pagination object in response)
ASSERT: Filter by action works (action=LISTING_STATUS_UPDATE)
ASSERT: Timestamps are in correct chronological order
ASSERT: actorId is never null for admin actions (only null for SYSTEM actions)
```

### Test 7.3 — Dispute Resolution (Full Flow)

**Pre-conditions:**
- Completed exchange exists between buyer and seller

**Steps:**

| # | Actor | Action | Expected API | DB Side-Effect |
|---|-------|--------|-------------|----------------|
| 1 | Buyer | Navigate to request, click "Raise Dispute" | POST `/api/disputes` with `{ requestId, type: 'ITEM_NOT_AS_DESCRIBED', description: '...' }` → 201 | Dispute created: `{ status: OPEN, type: ITEM_NOT_AS_DESCRIBED, raisedById: buyer.id, againstId: seller.id }`. Request status: COMPLETED → DISPUTED. AuditLog: `DISPUTE_CREATE` |
| 2 | Admin | Navigate to Disputes tab | GET `/api/admin/audit?action=DISPUTE_CREATE` shows entry. Dispute visible in disputes list | — |
| 3 | Admin | Begin review | PATCH dispute → `{ status: 'UNDER_REVIEW' }` | Dispute: OPEN → UNDER_REVIEW. AuditLog entry |
| 4 | Admin | Resolve dispute | PATCH  dispute → `{ status: 'RESOLVED' }` | Dispute: UNDER_REVIEW → RESOLVED. Request: DISPUTED → RESOLVED. AuditLog entry |

**Post-condition assertions:**

```
ASSERT: Dispute.status = 'RESOLVED'
ASSERT: Request.status = 'RESOLVED'
ASSERT: AuditLog has entries for: DISPUTE_CREATE, status transitions
ASSERT: Trust engine re-evaluated for seller (dispute count now included)
ASSERT: If seller now has 2+ disputes → trustStatus becomes 'REVIEW_REQUIRED'
ASSERT: admin/fraud dashboard reflects updated risk level
```

**Edge Cases:**

| # | Scenario | Expected |
|---|----------|----------|
| 7.3.1 | Escalate dispute | UNDER_REVIEW → ESCALATED. Higher privilege admin notified |
| 7.3.2 | Reject dispute | UNDER_REVIEW → REJECTED. No trust impact on accused |
| 7.3.3 | Duplicate dispute | Same buyer, same request → blocked (one active dispute per request) |
| 7.3.4 | Dispute on non-completed request | Should be blocked or only allowed from specific states |

### Test 7.4 — Fraud Dashboard

**Steps:**

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to Fraud tab | GET `/api/admin/fraud` → 200 |
| 2 | Review flagged users | Table shows: user email, risk level (HIGH/MEDIUM/LOW), flags, trust status, active disputes |
| 3 | Click user for drilldown | GET `/api/admin/users/<id>` → 200 with: `{ user, trust, fraud: { riskLevel, flags }, restriction }` |

**Risk level rules:**

```
HIGH  (2+ flags) → RED indicator (✖)
MEDIUM (1 flag)  → YELLOW indicator (⚠)
LOW (no flags)   → GREEN indicator (✓)
```

**Fraud heuristics checked:**
- Listing spike (many listings in 24h)
- High cancellation rate (7d window)
- Multiple disputes (30d window)
- New account sensitivity (<7 days old + suspicious activity)

### Test 7.5 — Stale Transaction Recovery (SUPER Only)

| # | Action | Expected |
|---|--------|----------|
| 1 | Create a request, leave in SENT status for 14+ days (simulate with DB manipulation) | — |
| 2 | Trigger recovery: POST `/api/admin/recovery` | Response: `{ recovered: { expiredRequests: N, revokedTokens: M, cleanedKeys: K } }` |
| 3 | Verify | Stale SENT requests → EXPIRED. Expired refresh tokens revoked. Expired idempotency keys purged |

**Assertions:**

```
ASSERT: Only SUPER privilege can access this endpoint
ASSERT: REVIEWER/OBSERVER get 403
ASSERT: Recovery is atomic (partial failure doesn't leave inconsistent state)
ASSERT: AuditLog entry for recovery action
```

---

## PHASE 8 — CHAOS TESTING

### Test 8.1 — Rapid Route Switching

```
SEQUENCE: /home → /resale → /accommodation → /academics → /essentials → /mess → /hospital → /profile → /admin → /home
SPEED:    < 500ms between navigations
REPEAT:   3 times

ASSERT: No blank page at any point
ASSERT: No "Cannot update unmounted component" warning
ASSERT: No orphaned GSAP contexts or ScrollTrigger instances
ASSERT: No Three.js WebGL context leak (if used)
ASSERT: React error boundary NOT triggered
ASSERT: Memory heap increase < 10MB across all iterations
```

### Test 8.2 — Slow Network (Throttle)

```
THROTTLE: 2G speed (50 KB/s, 500ms latency)

TEST A: Navigate to /resale
  ASSERT: Loading skeleton/spinner visible
  ASSERT: Page eventually renders (no timeout crash)
  ASSERT: Images lazy-load or show placeholder

TEST B: Submit listing creation form under throttle
  ASSERT: Submit button shows loading state
  ASSERT: Double-click guard prevents re-submission during slow network
  ASSERT: Timeout → graceful error message (not hanging forever)
  ASSERT: Form data preserved for retry

TEST C: Token refresh under throttle
  ASSERT: Refresh completes (may take longer)
  ASSERT: Queued requests wait and resolve with new token
  ASSERT: If refresh times out → graceful logout, not crash
```

### Test 8.3 — Expired Access Token Mid-Page

```
SETUP: User viewing /resale. Manually expire access token (wait 15+ min or manipulate).

TEST: Click "Request Exchange" on a listing
  STEP 1: API call fails with 401
  STEP 2: api-client interceptor triggers refresh
  STEP 3: POST /api/auth/refresh → new access token
  STEP 4: Original request retried automatically with new token
  STEP 5: User sees success (not an error)

ASSERT: User never sees 401 error in UI
ASSERT: No redirect to /login (refresh succeeded)
ASSERT: Request queue processed in order
ASSERT: If refresh also fails → redirect to /login
```

### Test 8.4 — Two Tabs Performing Same Action

```
SETUP: Open /resale in Tab A and Tab B. Both show same APPROVED listing.

TEST: Click "Request Exchange" in both tabs simultaneously
  EXPECTED: One tab succeeds (CAS lock wins). Other tab gets 409.
  TAB A: Shows success toast + request created
  TAB B: Shows error toast + listing status refreshed to INTEREST_RECEIVED

ASSERT: Only 1 request row in DB
ASSERT: Listing status = INTEREST_RECEIVED (not stuck in APPROVED)
ASSERT: Neither tab crashes
ASSERT: Both tabs eventually show consistent state
```

### Test 8.5 — Admin Action Spam

```
SETUP: Admin on /admin with 10 pending listings.

TEST: Rapidly click "Approve" on all 10 within 2 seconds
  EXPECTED: All 10 approved (or rate-limited gracefully)
  
ASSERT: Each listing transitions correctly
ASSERT: 10 AuditLog entries created (one per approval)
ASSERT: No 500 errors
ASSERT: admin/stats shows pendingListings = 0
ASSERT: Rate limit: PATCH /api/listings/*/status → 20/60min (well within limit for 10)
```

### Test 8.6 — Logout During Pending Request

```
SETUP: User has clicked "Request Exchange." API call in-flight.

TEST: Click logout before response arrives
  EXPECTED:
    - In-flight request may succeed or fail (race)
    - If succeeds: DB updated correctly, but user logged out
    - Logout completes: tokens cleared, redirect to /login
    - No zombie state (request created but user can't see it)

ASSERT: Logout always completes regardless of in-flight requests
ASSERT: No unhandled promise rejection
ASSERT: DB state is consistent (no half-created records)
```

---

## PHASE 9 — MULTI-TAB & REFRESH

### Test 9.1 — Login Propagation

```
SETUP: 2 tabs open. Tab A on /login, Tab B on /login.

TEST: Login in Tab A.
  EXPECTED: Tab B receives BroadcastChannel 'login' event → auto-navigates to /home

ASSERT: Tab B session hydrated within 2 seconds
ASSERT: Tab B shows authenticated nav state
ASSERT: No duplicate /auth/me calls from Tab B
```

### Test 9.2 — Logout Propagation

```
SETUP: 2 tabs authenticated. Tab A on /resale, Tab B on /profile.

TEST: Logout in Tab A.
  EXPECTED: Tab B receives 'logout' event → redirects to /login

ASSERT: Tab B redirected within 2 seconds
ASSERT: Tab B localStorage cleared
ASSERT: Tab B in-memory token nullified
ASSERT: Tab B protected route → /login redirect works
```

### Test 9.3 — Token Refresh Propagation

```
SETUP: 3 tabs authenticated. Token expires in 60s.

TEST: One tab triggers auto-refresh.
  EXPECTED: 
    - Only 1 POST /api/auth/refresh (not 3)
    - Winning tab broadcasts 'login' with new token
    - Other 2 tabs receive event and update their in-memory tokens

ASSERT: Exactly 1 refresh call (not N for N tabs)
ASSERT: All tabs have valid token after propagation
ASSERT: Subsequent API calls from any tab succeed
```

### Test 9.4 — Hard Refresh (F5) Recovery

```
SETUP: User authenticated on /resale.

TEST: Press F5 (full page reload).
  EXPECTED:
    - Access token lost (memory only) 
    - isHydrated = false → loading spinner
    - AuthContext calls /api/auth/refresh (cookie still present)
    - New access token received
    - /api/auth/me called → user hydrated
    - isHydrated = true → page renders

ASSERT: No flash of login page
ASSERT: User remains on /resale (not redirected)
ASSERT: All data reloaded via TanStack Query
ASSERT: GSAP animations re-initialize correctly
ASSERT: Hydration time < 2 seconds
```

### Test 9.5 — Back/Forward Navigation

```
TEST: /home → /resale → /listing/123 → Back → Forward
  ASSERT: Each page renders correctly
  ASSERT: No stale data displayed
  ASSERT: Scroll position restored
  ASSERT: No duplicate API calls on back navigation (TanStack Query cache hit)
```

---

## PHASE 10 — PERFORMANCE & MEMORY

### Test 10.1 — Initial Load Performance

```
METRICS (Production build, no throttle):
  First Contentful Paint (FCP):     < 1.5s
  Largest Contentful Paint (LCP):   < 2.5s
  Time to Interactive (TTI):        < 3.5s
  Total JS Bundle Size:             < 500KB gzipped
  Cumulative Layout Shift (CLS):    < 0.1
```

### Test 10.2 — Memory Leak Detection

```
PROCEDURE:
  1. Record initial heap snapshot (Chrome DevTools)
  2. Navigate: /home → /resale → /accommodation → /academics → /essentials → /profile → /admin
  3. Return to /home
  4. Record heap snapshot
  5. Repeat steps 2-4 three times
  6. Record final heap snapshot

ASSERT: Heap growth between snapshot 1 and snapshot 6 < 15MB
ASSERT: No detached DOM elements accumulating
ASSERT: No growing arrays (leaked event listeners, GSAP timelines, ScrollTrigger instances)
```

### Test 10.3 — GSAP Cleanup Verification

```
FOR EACH PAGE with GSAP animations:
  1. Navigate to page
  2. Let animations complete
  3. Navigate away
  4. Check: gsap.globalTimeline.getChildren().length should not grow on repeated visits
  
ASSERT: No orphaned ScrollTrigger instances (ScrollTrigger.getAll().length stable)
ASSERT: No orphaned GSAP timelines
ASSERT: gsap.killTweensOf() called in useEffect cleanup
ASSERT: No "GSAP target not found" warnings
```

### Test 10.4 — Three.js Context Management (If Used)

```
ASSERT: WebGL contexts created <= 1 per page
ASSERT: On navigation away: renderer.dispose() called
ASSERT: No "Too many WebGL contexts" browser warning
ASSERT: Canvas elements properly removed from DOM
```

### Test 10.5 — API Response Times

```
UNDER NORMAL LOAD:
  GET  /api/listings          < 200ms
  GET  /api/listings/:id      < 100ms
  POST /api/listings          < 500ms
  POST /api/requests          < 500ms
  PATCH /api/requests/:id/event < 300ms
  GET  /api/admin/stats       < 300ms
  GET  /api/admin/audit       < 500ms
  POST /api/auth/refresh      < 200ms
```

---

## PRODUCTION BLOCKER CHECKLIST

**If ANY of these are true → DO NOT PUBLISH:**

| # | Blocker | Detection Method |
|---|---------|-----------------|
| B-01 | Blank page on any route | Navigate to each route. Check for empty `<div id="root">` with no children |
| B-02 | Hydration mismatch | Check React console warnings: "Text content did not match" or "Hydration failed" |
| B-03 | Double submission creates duplicate records | Rapid-click test on all forms. Check DB for duplicates |
| B-04 | Inconsistent FSM state | DB listing status doesn't match expected FSM transition. Backend machine.can() disagrees with frontend |
| B-05 | Token refresh failure | Access token expires → refresh fails → user kicked to login (should be transparent) |
| B-06 | CSRF mismatch in production | Mutation returns 403 CSRF_INVALID and auto-recovery fails |
| B-07 | Contact data leak | Owner email/phone visible before ACCEPT in accommodation module (check API response, not just UI) |
| B-08 | Rate limit not enforced | Exceed rate limit → 200 instead of 429 |
| B-09 | Audit not logging | Perform admin action → check audit_logs table → row missing |
| B-10 | Dispute not mutating state | Raise dispute → request status doesn't change to DISPUTED |
| B-11 | Recovery job not cleaning stale requests | Requests stuck in SENT for >14 days → not auto-expired |
| B-12 | Any 500 error | Monitor server logs. Any unhandled exception is a blocker |
| B-13 | Self-exchange allowed | User can request their own listing |
| B-14 | Cross-role FSM manipulation | Buyer can send ACCEPT event (seller-only) or vice versa |
| B-15 | Restricted user can create/request | canPerform() bypass |
| B-16 | Admin without ADMIN role accesses admin routes | Student hits `/api/admin/*` → should get 403, not data |
| B-17 | Optimistic update doesn't rollback on error | Failed mutation leaves UI in wrong state |
| B-18 | BroadcastChannel desync | Logout in tab A → tab B still shows authenticated |
| B-19 | GSAP/Three.js memory leak | Heap grows unbounded on navigation cycles |
| B-20 | Password in storage | Access token or password found in localStorage/sessionStorage |

---

## GEMINI EXECUTION PROTOCOL

### Per-Phase Execution

For each phase, Gemini must:

1. **Execute** all happy path tests
2. **Execute** all edge case tests
3. **Execute** all failure injection tests
4. **Capture** for each test:
   - Console logs (errors, warnings)
   - Network tab (response codes, headers, timing)
   - DB state (query relevant tables)
   - UI state (screenshots or DOM assertions)
5. **Report** per-phase:
   ```
   PHASE N: [MODULE]
   ├── Tests Passed:  X / Y
   ├── Tests Failed:  Z
   ├── Blockers Found: [B-XX, B-YY]
   ├── Warnings:      [list]
   ├── Console Errors: [list]
   └── DB Inconsistencies: [list]
   ```

### After All Phases

```
═══════════════════════════════════════════
       PRODUCTION READINESS VERDICT
═══════════════════════════════════════════
Phases Passed:     X / 10
Blockers Found:    [ list with IDs ]
Warnings:          [ list ]
Publish Decision:  GO / NO-GO
───────────────────────────────────────────
If NO-GO:
  Priority fixes required:
    1. [B-XX] description → fix location
    2. [B-YY] description → fix location
═══════════════════════════════════════════
```

### Critical Risk Areas (Gemini Should Probe Hardest)

1. **State desync between frontend and backend** — Optimistic updates that don't rollback. TanStack Query cache stale after mutations. Frontend FSM state diverging from DB state.

2. **Animation lifecycle bugs** — GSAP ScrollTrigger instances not killed on unmount. Three.js canvases accumulating WebGL contexts. GSAP timelines referencing detached DOM nodes.

3. **Token refresh race** — Two tabs trigger refresh simultaneously. First succeeds, second fails (old token revoked). Second tab retries with BroadcastChannel token but timing is off.

4. **Double mutation from optimistic UI** — Click fires mutation → optimistic update → user sees result → clicks again → second mutation races with cache invalidation from first.

5. **Orphaned GSAP/Three contexts** — Every page navigation creates new animation contexts. If cleanup is missed in even one page, memory grows linearly with navigation count.

---

*End of specification. Gemini: execute phases 1-10 sequentially. Do not skip any phase. Report findings after each phase before proceeding to the next.*
