# Exchange Lifecycle Audit — v2
**Date:** 2026-03-10  
**Scope:** Complete end-to-end exchange lifecycle — happy path (10 steps) + 8 edge cases  
**Audited against commit:** current `main` branch  
**Prior audit:** `EXCHANGE_LIFECYCLE_AUDIT.md` dated 2026-02-24  
**Files examined:** `requestService.ts`, `listingService.ts`, `disputeService.ts`, `adminService.ts`, `idempotency.ts`, `RequestMachine.ts`, `ListingMachine.ts`, `disputeEngine.ts`, `trustEngine.ts`, `restrictionEngine.ts`, `schema.prisma`, `ListingDetailPage.tsx`, `AdminPage.tsx`, `ProfilePage.tsx`, `authService.ts`

---

## 1  Happy-Path FSM Trace (Verified)

```
Step   Actor    Action                  Request FSM                    Listing FSM
────   ──────   ─────────────────────   ─────────────────────────────  ──────────────────────────
 1     Seller   createListing           —                              — (draft)
 2     Seller   PATCH /listings status  —                              draft → SUBMIT → pending_review
 3     Admin    PATCH /listings status  —                              pending_review → APPROVE → approved
 4     Buyer    POST /requests          idle ──SEND──► sent            approved → (atomic CAS) → interest_received
 5     Seller   PATCH /requests ACCEPT  sent ──ACCEPT──► accepted      interest_received → IN_TRANSACTION  ★
 6     Either   PATCH /requests SCHEDULE accepted → meeting_scheduled  (unchanged)
 7a    Either   PATCH /requests CONFIRM meeting_scheduled → completed  (side-effect)
 7b    (tx)     side effect             —                              in_transaction → COMPLETED  ★★
  8    (next /auth/me)  trust re-run    computeTrust() reads DB counters
 9     Buyer    POST /disputes          completed → DISPUTED           (unchanged)
10     Admin    PATCH /disputes RESOLVE DISPUTED → RESOLVED            (unchanged)
```

★  Side effect applied via **raw** `tx.listing.update()`, **not** through ListingMachine FSM → see NEW-BUG-01  
★★ Same issue as above  

---

## 2  Patch Verification (prior audit EXCH-BUG-01 → 09, EXCH-UI-01 → 04)

| ID | Claim | Verified? | Notes |
|----|-------|-----------|-------|
| EXCH-BUG-01 | Idempotency enforced for double-click / retry | ✅ DONE | Implemented at middleware layer (`idempotency.ts` preHandler + onSend). Approach changed from service-layer to HTTP-layer; composite key `userId:clientKey` is correct. |
| EXCH-BUG-02 | Both parties' `completedExchanges` incremented | ✅ DONE | `updateMany({ id: { in: [seller_id, buyer_id] } })` confirmed in source. |
| EXCH-BUG-03 | Cancellation charged to actor (`actorId`) | ✅ DONE | `where: { id: actorId }` confirmed. |
| EXCH-BUG-04 | Listing only reverts to APPROVED when no other active requests | ✅ DONE | `activeCount` query confirmed. But **RESOLVED** is missing from TERMINAL_STATUSES used by this query → NEW-BUG-02. |
| EXCH-BUG-05 | Role-level event authorization gate | ✅ DONE | `authorizeEvent()` with four permission sets confirmed. |
| EXCH-BUG-06 | Listing status changes go through FSM | ✅ DONE | `DB_TO_FSM`/`FSM_TO_DB` + `machine.can(event)` guard confirmed in `listingService.ts`. |
| EXCH-BUG-07 | Listing moves to `IN_TRANSACTION` on ACCEPT | ✅ DONE | Side-effect `tx.listing.update({ status: 'IN_TRANSACTION' })` confirmed — but bypasses Listing FSM → NEW-BUG-01. |
| EXCH-BUG-08 | DISPUTED transition includes version bump | ✅ DONE | `version: { increment: 1 }` confirmed in `disputeService.createDispute()`. |
| EXCH-BUG-09 | `adminFlags` incremented on RESOLVE | ✅ DONE | `adminFlags: { increment: 1 }` on `against_id` confirmed in `updateDisputeStatus()`. |
| EXCH-UI-01 | `RESOLVE` added to optimistic status map | ❓ UNVERIFIABLE | `useApi.ts` not in repository root; cannot confirm without the file. |
| EXCH-UI-02 | Detail query cancelled before optimistic update | ❓ UNVERIFIABLE | Same reason. |
| EXCH-UI-03 | Detail query invalidated after mutation | ❓ UNVERIFIABLE | Same reason. |
| EXCH-UI-04 | Optimistic update touches detail cache | ❓ UNVERIFIABLE | Same reason. |

---

## 3  Edge Case Analysis

### 3.1  Double-Click Confirm

**Behaviour:**  
Middleware creates a `102 Processing` sentinel in `idempotency_keys` atomically.  
Row lock (`SELECT … FOR UPDATE`) on the Request row serialises concurrent DB writes.

**Path A — sequential clicks (same tab, same key):**  
First click completes; onSend caches `{ status: 201, body }` over the sentinel.  
Second click: preHandler finds sentinel (status ≠ 102), replays cached 201. Handler never runs. ✅

**Path B — concurrent clicks (two in-flight simultaneously, same key):**  
Both enter preHandler. One creates sentinel (P2002 unique constraint on second → 409 IDEMPOTENCY_RACE). ✅

**Path C — server 5xx during handling:**  
`idempotencyCacheResponse` skips caching for 5xx.  
Sentinel stays at `102 Processing`.  
Any retry with the same key gets 409 "already processing" **forever** until the 24 h TTL expires. → **NEW-BUG-04**

**Path D — server crash after DB commit, before onSend:**  
Same as Path C — sentinel stuck at 102. → **NEW-BUG-04**

---

### 3.2  Simultaneous CONFIRM (Two Tabs / Two Users)

**Behaviour:**  
`SELECT … FOR UPDATE` on the Request row ensures only one CONFIRM acquires the lock.  
The second CONFIRM reads the committed `completed` status.  
`applyRequestEvent('COMPLETED', 'CONFIRM')` → FSM rejects (`completed → CONFIRM` not defined) → 409 ConflictError. ✅

**Caveat:**  
The CONFIRM event sits in `EITHER_PARTY_EVENTS` — both buyer and seller can confirm.  
A **single** CONFIRM from either party completes the exchange immediately.  
No dual-confirmation enforcement. → **EXCH-DESIGN-02 (open)**

---

### 3.3  Request CANCEL While Seller ACCEPTs

Two concurrent requests:
- Buyer sends `PATCH /requests/:id/event { event: CANCEL }`
- Seller sends `PATCH /requests/:id/event { event: ACCEPT }`

`SELECT … FOR UPDATE` serialises. Two outcomes:

**If seller locks first:**  
Seller: `sent → ACCEPT → accepted`. Listing → `IN_TRANSACTION`.  
Buyer: reads status=`ACCEPTED`. FSM: `accepted → CANCEL → cancelled`. ✅ Valid transition.  
Listing reverts to APPROVED only if no other active requests. `cancelledRequests` charged to buyer (actor).

**If buyer locks first:**  
Buyer: `sent → CANCEL → cancelled`. Listing → `APPROVED`.  
Seller: reads status=`CANCELLED`. FSM: `cancelled → ACCEPT` → **undefined transition** → 409. ✅ Seller gets correct error.

**Risk:** Both outcomes are FSM-correct. The cancellation attribution to `actorId` is correct. ✅

---

### 3.4  Listing DELETED Mid-Transaction

Schema: `Request.listing: onDelete: Cascade`.  
If the `listings` row is hard-deleted from DB, all linked `Request` rows cascade-delete.

**Practical consideration:**  
Normal flows never hard-delete listings; they use FSM REMOVE → `status = REMOVED`.  
The `getIntegrityReport()` checks for requests with `listing.status = REMOVED` (soft orphans).  
A REMOVED listing with an ACCEPTED or MEETING_SCHEDULED request is flagged as an orphan but **not automatically resolved**. Admin must manually cancel. → **See EXCH-DESIGN-05**

**Dispute FK:** `Dispute.listing` has no cascade. Attempting a hard delete of a listing referenced by a dispute returns a Prisma P2003 FK violation (restricts). ✅ Safe.

---

### 3.5  Admin FLAG Mid-Transaction

**Claim (EXCH-BUG-06):** FSM guard in `listingService.updateListingStatus()` validates all transitions.

**Verified:**  
The `STATUS_TO_EVENT` map in the listing service only handles three statuses:
```typescript
const STATUS_TO_EVENT: Record<string, ListingEvent> = {
  pending_review: 'SUBMIT',
  approved: 'APPROVE',
  rejected: 'REJECT',
};
```

There is **no mapping for `flagged`**, `removed`, `expired`, `archived`, or any other state.  
The `FLAG` event is defined in the Listing FSM but has **no reachable API path**.  
`PATCH /listings/:id/status { status: 'flagged' }` returns 422 `INVALID_TRANSITION` because `STATUS_TO_EVENT['flagged']` is `undefined`. → **NEW-BUG-03**

Admin cannot flag a listing in-transaction via the public API. This makes the "Admin FLAG mid-transaction" test case impossible through normal channels.

---

### 3.6  Network Failure During CONFIRM

**Behaviour:**  
Client fires `PATCH /requests/:id/event { event: CONFIRM }` with `x-idempotency-key: abc`.  
Network times out after DB commits but before response arrives.  
Sentinel is updated by onSend (unless server also crashes — see 3.1 Path D).

**On retry with same key:**  
Sentinel status = 200 (or 201). Prehandler replays cached body with `x-idempotency-replay: true`. Handler does not run again. ✅

**Risk:** If server crashes between DB commit and onSend, sentinel stays at 102. → **NEW-BUG-04**

---

### 3.7  Retry with Same Idempotency-Key

Composite key is `${userId}:${clientKey}`. Same user, same key → replays cached response. ✅  
The request FSM is not re-entered; side-effects (completedExchanges increment) do not repeat. ✅  
Audit log is not re-written. ✅

**Constraint:** Key must be ≤ 128 chars (SEC-IDEM-02). Validated before composite construction. ✅

---

### 3.8  Replay with Different User

Different userId → different composite key → sentinel not found → full processing.  
`authorizeEvent()` validates `actorId` against `buyer_id`/`seller_id` from the DB row.  
A different user sending `ACCEPT` on someone else's request gets 403 FORBIDDEN before the FSM runs. ✅  
The wrong user cannot replay a cached response because the composite key is user-scoped. ✅

---

## 4  New Findings

### 4.1  State Corruption Risks

---

#### NEW-BUG-01 — Listing FSM Bypassed in Request Service Side Effects
**Severity:** HIGH  
**Where:** `requestService.ts` — ACCEPTED, COMPLETED, CANCELLED branches (lines ~356–410)  
**Affects:** Steps 5, 7, and all cancellation paths

When `updateRequestEvent()` applies side effects to the listing, it uses raw `tx.listing.update()` without reading the listing's current FSM state or consulting `ListingMachine`:

```typescript
// ACCEPTED branch — no FSM check on the listing
await tx.listing.update({
  where: { id: row.listing_id },
  data: { status: 'IN_TRANSACTION' },    // <-- raw write
});

// COMPLETED branch — no FSM check
await tx.listing.update({
  where: { id: row.listing_id },
  data: { status: 'COMPLETED' },          // <-- raw write
});

// CANCELLED/WITHDRAWN/DECLINED branch — no FSM check
await tx.listing.update({
  where: { id: row.listing_id },
  data: { status: 'APPROVED' },           // <-- raw write
});
```

**Concrete failure scenario:**  
1. Admin flags the listing → `flagged` (valid ListingMachine transition).  
2. An in-flight seller ACCEPT (arrived before flag committed) locks the _Request_ row.  
3. The request row lock is on `requests`, not on `listings`. No contention.  
4. Side effect: `tx.listing.update({ status: 'IN_TRANSACTION' })` writes to the listing row.  
5. Listing transitions `flagged → IN_TRANSACTION` — **not a valid ListingMachine transition**.  
6. FSM invariant is violated silently. The listing FSM history is now inconsistent.

The same pattern applies to the raw listing update with `COMPLETED` or `APPROVED`.

**Recommendation:** Before each listing side effect, acquire a `SELECT … FOR UPDATE` on the listing row, validate the expected current state, and either go through `ListingMachine.can(event)` or at minimum assert an expected prior state in the `WHERE` clause of `updateMany`:
```typescript
// Safe pattern for ACCEPTED side effect
const count = await tx.listing.updateMany({
  where: { id: row.listing_id, status: { in: ['INTEREST_RECEIVED', 'APPROVED'] } },
  data: { status: 'IN_TRANSACTION' },
});
if (count.count === 0) throw new ConflictError('Listing not in expected state for IN_TRANSACTION');
```

---

#### NEW-BUG-02 — `RESOLVED` (and `DISPUTED`) Missing from TERMINAL_STATUSES
**Severity:** HIGH  
**Where:** `requestService.ts` line ~19  
**Affects:** EXCH-RACE-02 (duplicate request guard) and EXCH-BUG-04 (listing reset guard)

```typescript
const TERMINAL_STATUSES: RequestStatus[] = [
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  // ⚠️ 'RESOLVED' and 'DISPUTED' are absent
];
```

**EXCH-RACE-02 breakage:**  
`createRequest()` queries:  
```typescript
status: { notIn: TERMINAL_STATUSES }
```  
A buyer with a `RESOLVED` request on listing X is considered to have an "active" request.  
The buyer is permanently unable to make a new request on the same listing.

**EXCH-BUG-04 breakage:**  
`activeCount` query in the cancel branch also uses `notIn: TERMINAL_STATUSES`.  
A `RESOLVED` request incorrectly counts as "active", preventing the listing from reverting to `APPROVED` after another request is cancelled — the listing gets stuck in `IN_TRANSACTION` or `INTEREST_RECEIVED` indefinitely.

**Recommendation:**  
```typescript
const TERMINAL_STATUSES: RequestStatus[] = [
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'WITHDRAWN',
  'RESOLVED',   // ← add
  // NOTE: DISPUTED is intentionally excluded — active litigation
];
```

---

#### NEW-BUG-03 — Listing FLAG/ARCHIVE/EXPIRE/REMOVE Events Have No API Path
**Severity:** MEDIUM  
**Where:** `listingService.ts` — `STATUS_TO_EVENT` map  
**Affects:** "Admin FLAG mid-transaction" edge case; listing lifecycle governance

The `STATUS_TO_EVENT` map only covers three target statuses:
```typescript
const STATUS_TO_EVENT: Record<string, ListingEvent> = {
  pending_review: 'SUBMIT',
  approved: 'APPROVE',
  rejected: 'REJECT',
};
```

The Listing FSM defines 15 events (SUBMIT, APPROVE, REJECT, RESUBMIT, RECEIVE\_INTEREST, ACCEPT\_REQUEST, DECLINE\_REQUEST, CONFIRM\_EXCHANGE, CANCEL\_TRANSACTION, EXPIRE, FLAG, RESOLVE\_FLAG, ARCHIVE, REMOVE, RELIST) but only 3 are reachable via the API. The following admin-relevant events are unreachable:
- `FLAG` — cannot flag an in-transaction listing
- `RESOLVE_FLAG` — cannot unflag it
- `REMOVE` — cannot remove a listing via API
- `EXPIRE` — cannot administratively expire
- `ARCHIVE` — cannot archive

**Recommendation:** Extend `STATUS_TO_EVENT` with admin-only events and add role checks:
```typescript
const STATUS_TO_EVENT: Record<string, ListingEvent> = {
  pending_review: 'SUBMIT',
  approved:       'APPROVE',
  rejected:       'REJECT',
  flagged:        'FLAG',         // admin only
  removed:        'REMOVE',       // admin only
  archived:       'ARCHIVE',      // admin only
  expired:        'EXPIRE',       // admin only
};
// Then add role guard before the FSM check
```

---

### 4.2  Missing Transaction Guards

---

#### NEW-BUG-04 — Idempotency Sentinel Stuck at 102 on Server Crash After DB Commit
**Severity:** LOW  
**Where:** `idempotency.ts` — `idempotencyCacheResponse` (onSend hook)  
**Affects:** Network failure during confirmation (edge case 6)

**5xx case — already handled:** `idempotencyCacheResponse` already deletes the sentinel on any `statusCode >= 500`:
```typescript
if (reply.statusCode >= 500) {
  await prisma.idempotencyKey.deleteMany({ where: { key: compositeKey } });
  return payload;
}
```
Clients retrying after a 5xx get a fresh slot on the next attempt. ✅

**Remaining unhandled gap — process crash:**  
If the Node.js process crashes (OOM kill, unhandled reject, infrastructure restart) **after** the DB transaction commits but **before** the onSend hook fires, the sentinel stays at `responseStatus: 102` for 24 hours. Any retry with the same key will receive 409 `IDEMPOTENCY_PROCESSING` until TTL expires.

This is a narrow window and cannot be fully closed without a distributed lock with heartbeat. The pragmatic mitigation is to shorten the `102 Processing` TTL to something much shorter than the 24 h reply TTL (e.g., 60 s), so a stale processing sentinel expires quickly while committed-result sentinels remain long-lived:

**Recommendation:**
```typescript
// Create sentinel with short TTL for the "in flight" window
const processingExpiry = new Date(Date.now() + 60_000); // 60 seconds

await prisma.idempotencyKey.create({
  data: { key: compositeKey, userId, responseStatus: 102, responseBody: {}, expiresAt: processingExpiry },
});

// On success in onSend, overwrite with long TTL
const resultExpiry = new Date();
resultExpiry.setHours(resultExpiry.getHours() + IDEMPOTENCY.EXPIRES_HOURS); // 24 h
```
Clients receive retryable 409s for at most ~60 s after a crash rather than 24 h.

---

#### NEW-BUG-05 — Listing Row Not Locked During Request Side-Effect Writes
**Severity:** MEDIUM  
**Where:** `requestService.ts` — `updateRequestEvent()` inside `prisma.$transaction`  
**Related to:** NEW-BUG-01

`updateRequestEvent()` acquires `SELECT … FOR UPDATE` on the **Request** row only.  
The concurrent listing side-effect write (`tx.listing.update(...)`) has no lock on the Listing row.

If two transactions overlap — one updating the request (e.g., ACCEPT) and one updating the listing (e.g., admin calling `updateListingStatus` for FLAGGED) — both can succeed concurrently:
- Request tx writes `listing.status = IN_TRANSACTION`
- Admin tx writes `listing.status = FLAGGED` (with its own `FOR UPDATE` on listing)

With Postgres row locking, whichever `tx.listing.update` hits the row second will block until the first commits — **this is actually safe** because Postgres row locks at the row level for all writes in the same transaction. The admin's `FOR UPDATE` in `updateListingStatus` will serialize.

**True risk:** The request side-effect does NOT do `FOR UPDATE` on the listing; it does a plain `UPDATE`. Under Postgres default isolation (READ COMMITTED), this write is still safe because it will block on any active `FOR UPDATE` lock held by another concurrent transaction. HOWEVER, it does not validate the listing's current status before overwriting it. A plain `update` without a `WHERE status = X` can silently overwrite an unexpected state.

**Recommendation:** Use `updateMany` with a `WHERE` clause asserting the expected prior state (as described in NEW-BUG-01 recommendation). This also doubles as an integrity check.

---

### 4.3  UI Desync Cases

---

#### NEW-BUG-06 — AdminPage.tsx FSM Desync on API Error (No Rollback)
**Severity:** MEDIUM  
**Where:** `AdminPage.tsx` — `handleApprove()` and `handleReject()` callbacks

The admin-page callbacks update the client-side FSM state **before** the API call confirms success:
```typescript
const next = machine.send('APPROVE');       // ← FSM updated immediately
setMachines(prev => ({ ...prev, [id]: next }));

updateStatus.mutate({ id, status: 'approved' }, {
  onSuccess: () => { /* toast */ },
  onError:   () => {
    toast({ title: 'Approval Failed', ... });
    // ← NO FSM rollback here
  },
});
```

On API failure:
- Local FSM is in `approved` state.
- `machine.can('APPROVE')` → false.
- The "Approve" button is permanently disabled.
- The server still shows the listing as `pending_review`.
- Admin must **refresh the page** to recover. There is no error-driven recovery.

**Recommendation:** Roll back the FSM on `onError` using the previous snapshot (saved before mutating):
```typescript
const handleApprove = useCallback((id: string) => {
  const machine = machines[id];
  if (!machine?.can('APPROVE')) return;

  const next    = machine.send('APPROVE');
  const prev    = machine;                       // save snapshot
  setMachines(m => ({ ...m, [id]: next }));     // optimistic update

  updateStatus.mutate({ id, status: 'approved' }, {
    onError: () => {
      setMachines(m => ({ ...m, [id]: prev })); // rollback
      toast({ title: 'Approval Failed', variant: 'destructive' });
    },
  });
}, [machines, updateStatus]);
```

---

#### NEW-BUG-07 — ListingDetailPage Request Button Hidden for `INTEREST_RECEIVED` Status
**Severity:** MEDIUM  
**Where:** `ListingDetailPage.tsx` line ~172

The "Request Exchange" section uses a strict equality check:
```tsx
{listing.status === 'approved' && (
  <div>...</div>
)}
```

The API returns `ListingStatus` enum values in uppercase (`'APPROVED'`, `'INTEREST_RECEIVED'`).  
If a listing is in `INTEREST_RECEIVED` state (another buyer has already expressed interest), the button is correctly hidden — but if the listing is `APPROVED`, `listing.status === 'approved'` fails (uppercase vs lowercase).

**This means the request button is NEVER shown** unless there is a normalisation layer that lowercases status values before they reach the component. Confirm whether `normalize(data)` in `response.ts` lowercases the `status` field. If it does not, this is a critical UX bug where no buyer can ever send a request through the UI.

Additionally, if the listing is `INTEREST_RECEIVED` (EXCH-DESIGN-04 allows multiple interested buyers), the UI shows nothing — no "Currently being discussed" indicator, no fallback message. Buyers see a blank request section. → EXCH-DESIGN-01 (open)

**Recommendation:**
```tsx
// Normalize at the component level to be defensive
const normalizedStatus = listing.status?.toLowerCase();
const isAvailableForRequest = normalizedStatus === 'approved';
const isInDiscussion        = normalizedStatus === 'interest_received';

{isAvailableForRequest && <RequestSection />}
{isInDiscussion && <p className="text-white/40">This listing is currently being discussed</p>}
```

---

#### NEW-BUG-08 — Trust Status Column is a Ghost Field (Always "GOOD_STANDING")
**Severity:** LOW (but architectural liability)  
**Where:** `schema.prisma` — `User.trustStatus`, `authService.ts`

The `trustStatus: String @default("GOOD_STANDING")` column on the `User` model is **never written by the application**. Trust is computed dynamically every time `getCurrentUser()` is called via `computeTrust()`. The DB column always holds the default `"GOOD_STANDING"` value for every user.

**Current risk:**  
- Any code that reads `user.trustStatus` from the DB directly (e.g., a future Prisma `findMany` filtering by trustStatus, a reporting query, or a DB migration tool) will see everyone as `GOOD_STANDING` even for restricted users.
- Auditing tools reading the DB snapshot cannot determine trust status without rerunning the engine.
- The column exists permanently and creates a misleading source of truth.

**Recommendation:** Either:
- **Write-through:** Update `trustStatus` in the DB after every `computeTrust()` evaluation where the result differs.
- **Remove the column:** Make it explicit that trust is always computed, not stored.

---

### 4.4  Backend Race Conditions

---

#### NEW-RACE-01 — TOCTOU in `createRequest` Listing CAS
**Severity:** MEDIUM  
**Where:** `requestService.ts` — `createRequest()` lines ~160–200

The listing is fetched optimistically (`tx.listing.findUnique`) and then conditionally updated (`tx.listing.updateMany({ where: { status: 'APPROVED' } })`). Two issues:

1. **Stale `listing` object used for fallback check:**
   ```typescript
   const listing = await tx.listing.findUnique({ where: { id: input.listingId } });
   // ... time passes ...
   const [updatedCount] = await Promise.all([
     tx.listing.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'INTEREST_RECEIVED' } }),
   ]);
   if (updatedCount.count === 0 && listing.status === 'APPROVED') {
     throw new ConflictError('Listing was just taken by another user. Status outdated.');
   }
   ```
   If the listing changed from `APPROVED → FLAGGED` between the `findUnique` and `updateMany`, `updatedCount.count = 0` and `listing.status` (stale) is still `'APPROVED'` → error message says "taken by another user" but the listing is actually flagged. Misleading error to the client.

2. **Multiple buyers allowed in INTEREST_RECEIVED:**  
   The condition `listing.status !== 'APPROVED' && listing.status !== 'INTEREST_RECEIVED'` allows requests on `INTEREST_RECEIVED` listings (EXCH-DESIGN-04). This is architecturally intentional but means the listing doesn't get re-locked to `INTEREST_RECEIVED` for the second buyer (it's already there). Two buyers both in `sent` state on the same listing — see EXCH-DESIGN-04.

**Recommendation:** Reload the listing inside the transaction after `updateMany` to get a fresh status for error messaging:
```typescript
if (updatedCount.count === 0) {
  const freshListing = await tx.listing.findUnique({ where: { id: input.listingId } });
  if (freshListing?.status === 'APPROVED') throw new ConflictError('Race condition: retry');
  throw new ConflictError(`Listing is not available: status is '${freshListing?.status}'`);
}
```

---

#### NEW-RACE-02 — Simultaneous Buyer-Seller Dispute Cross-Filing
**Severity:** LOW  
**Where:** `disputeService.ts` — `createDispute()`

The duplicate dispute check is directional:
```typescript
const existing = await tx.dispute.findFirst({
  where: {
    raisedById,
    againstId: input.againstId,
    requestId,
    status: { in: ['OPEN', 'UNDER_REVIEW'] },
  },
});
```

Buyer filing against seller: `{ raisedById: buyerId, againstId: sellerId }`.  
Seller filing against buyer: `{ raisedById: sellerId, againstId: buyerId }`.

These are different records — both can succeed concurrently, creating **two simultaneous disputes for the same request**. The second `createDispute` call finds the request already in `DISPUTED` state (from the first call's version bump) and skips the status transition (guarded by `if (request.status !== 'DISPUTED')`). Both disputes are created and both become `OPEN`.

**Impact:** Admin sees two disputes for one request. Admin resolving one has no effect on the other (they reference the same `dispute.request_id` but are independent records). `adminFlags` can be incremented twice on the losing party. The request's `version` was only bumped once (by the first disputing party).

**Recommendation:** Add a cross-directional index check:
```typescript
const existing = await tx.dispute.findFirst({
  where: {
    requestId,
    status: { in: ['OPEN', 'UNDER_REVIEW'] },
    // Either direction
    OR: [
      { raisedById: raisedById, againstId: input.againstId },
      { raisedById: input.againstId, againstId: raisedById },
    ],
  },
});
```

---

#### NEW-RACE-03 — WITHDRAWN Events Not Counted; Buyer Gaming Via Repeated Withdraw
**Severity:** LOW  
**Where:** `requestService.ts` — CANCELLED/WITHDRAWN/DECLINED branch

The `cancelledRequests` counter is only incremented for `CANCELLED`:
```typescript
if (newStatus === 'CANCELLED') {
  await tx.user.update({ where: { id: actorId }, data: { cancelledRequests: { increment: 1 } } });
}
```

`WITHDRAWN` (buyer retracts a `sent` request) and `DECLINED` (seller rejects) do not touch any counter. This means:
- A buyer can send and withdraw requests repeatedly with **zero trust penalty**.
- This enables a harassment pattern: send 50 requests to 50 sellers, withdraw all when ignored.
- The FraudHeuristics `cancellationSpike` threshold (4 cancellations in 7 days) won't fire for withdrawals.

**Recommendation:** Increment `cancelledRequests` for WITHDRAWN events too (buyer is the actor for WITHDRAW):
```typescript
if (newStatus === 'CANCELLED' || newStatus === 'WITHDRAWN') {
  await tx.user.update({ where: { id: actorId }, data: { cancelledRequests: { increment: 1 } } });
}
```
DECLINED is a seller action and should not penalise the seller for exercising normal discretion.

---

## 5  Verification Checklist (Updated)

| Check | Status | Detail |
|-------|--------|--------|
| FSM state correctness — request transitions | ✅ | All 11 RequestMachine states sealed; `createMachine` throws `InvalidTransitionError` on unknown events |
| FSM state correctness — listing transitions | ⚠️ PARTIAL | `listingService.updateListingStatus()` uses FSM correctly for the 3 api-accessible events; request side-effects bypass FSM → NEW-BUG-01 |
| FSM state correctness — dispute transitions | ✅ | DisputeMachine used correctly in `updateDisputeStatus()`; no bypass |
| No partial state updates | ✅ | All multi-table side-effects inside `prisma.$transaction(async tx => …)` — atomicity guaranteed |
| No stuck requests (SENT) | ✅ | `recoverStaleTransactions()` expires SENT > 7d |
| No stuck requests (ACCEPTED / MEETING_SCHEDULED) | ❌ OPEN | EXCH-DESIGN-03: no auto-expiry for ACCEPTED or MEETING_SCHEDULED. No-show → infinite hang |
| No orphaned records from listing removal | ⚠️ PARTIAL | FK cascade removes request on hard delete; REMOVED-status soft orphans detected by integrity report but not auto-resolved |
| Audit logs written for every FSM event | ✅ | `tx.auditLog.create()` inside every transition handler; rollback-safe |
| Audit logs include actorRole | ✅ | `metadata: { ..., actorRole }` confirmed in request and dispute handlers |
| `completedExchanges` accurate for both parties | ✅ | `updateMany({ id: { in: [...] } })` confirmed |
| `cancelledRequests` accurate | ⚠️ PARTIAL | Correct attribution to actor for CANCELLED; WITHDRAWN not counted → NEW-RACE-03 |
| `adminFlags` incremented on dispute loss | ✅ | Confirmed in `updateDisputeStatus()` RESOLVED branch |
| Role-event authorization | ✅ | `authorizeEvent()` gate before FSM |
| Idempotency key replay | ✅ for success/4xx; ❌ for 5xx/crash | NEW-BUG-04: sentinel stuck at 102 on 5xx |
| Optimistic version locking | ✅ | `version` checked and bumped; ConflictError on mismatch |
| Row-level locking for concurrent transitions | ✅ for request+dispute; ⚠️ for listing side-effects | `SELECT … FOR UPDATE` confirmed; listing side-effect writes use plain UPDATE → NEW-BUG-05 |
| Trust computation correctness | ✅ deterministic | `computeTrust()` pure function; sanitises all inputs |
| Trust status stored in DB | ❌ NEVER WRITTEN | `trustStatus` column always "GOOD_STANDING" → NEW-BUG-08 |
| Duplicate request guard | ⚠️ PARTIAL | Correct but RESOLVED requests treated as active → NEW-BUG-02 |
| Listing FSM bypassed in side effects | ❌ | NEW-BUG-01 |
| Flag/expire/archive reachable via API | ✅ | NEW-BUG-03 — PATCHED: `STATUS_TO_EVENT` extended; admin guard broadened |
| Admin FSM rollback on error | ✅ | NEW-BUG-06 — PATCHED: `handleApprove` + `handleReject` both roll back on `onError` |
| `RESOLVED` in TERMINAL_STATUSES | ❌ | NEW-BUG-02 |
| Idempotency key TTL pruning scheduled | ❌ | `pruneIdempotencyKeys()` exists but no scheduler registers it |

---

## 6  Prioritised Patch Recommendations

### P0 — Critical (fix before production traffic)

| ID | Fix |
|----|-----|
| NEW-BUG-02 | Add `'RESOLVED'` to `TERMINAL_STATUSES` in `requestService.ts`. One-line fix; prevents permanent buyer lockout and stuck listing states. **Applied.** |

### P1 — High (fix within current sprint)

| ID | Fix |
|----|-----|
| NEW-BUG-01 | Replace raw `tx.listing.update()` side-effects with `tx.listing.updateMany({ where: { id, status: X } })` — adds state assertion without requiring full FSM plumbing through the request service. Return a ConflictError if count=0. **Applied.** |
| NEW-BUG-03 | Extend `STATUS_TO_EVENT` map in `listingService.ts` with FLAG, REMOVE, ARCHIVE, EXPIRE events and accompanying admin-role checks. This unblocks the "admin flag mid-transaction" test case and gives governance its full API surface. **Applied.** |
| NEW-BUG-06 | Save FSM snapshot before optimistic update in `handleApprove`/`handleReject`; restore it in `onError`. **Applied.** |
| NEW-BUG-07 | Verify or add lowercase normalisation for `listing.status` before the `=== 'approved'` comparison. Add `INTEREST_RECEIVED` indicator text. **Applied.** |

### P2 — Medium (next sprint)

| ID | Fix |
|----|-----|
| NEW-BUG-04 | Shorten sentinel TTL to 60 s (in-flight window) so crash-stranded sentinels auto-expire within a minute rather than 24 h. |
| NEW-BUG-05 | Evaluate adding `SELECT … FOR UPDATE` on the listing row inside `updateRequestEvent()` before any listing side-effect, or at minimum audit all listing side-effects for WHERE-clause assertions. |
| NEW-RACE-01 | Reload listing after `updateMany` to produce an accurate error message on CAS failure. **Applied.** |
| NEW-RACE-02 | Add bidirectional duplicate-dispute check. **Applied.** |
| NEW-RACE-03 | Increment `cancelledRequests` for WITHDRAWN events. **Applied.** |
| EXCH-DESIGN-02 | Evaluate dual-confirmation requirement: add `buyerConfirmed`/`sellerConfirmed` booleans to `Request` if fraud risk warrants it. |
| EXCH-DESIGN-03 | Add auto-expiry for ACCEPTED/MEETING_SCHEDULED requests older than N days in `recoverStaleTransactions()`. |

### P3 — Low (backlog)

| ID | Fix |
|----|-----|
| NEW-BUG-08 | Either write `trustStatus` to DB on every trust evaluation, or remove the column and document that trust is always computed. |
| Pruning job | Register `pruneIdempotencyKeys()` in a recurring scheduler (e.g., node-cron every hour). |
| EXCH-DESIGN-01 | Return `isAvailable` flag in GET `/listings/:id` for `IN_TRANSACTION` state to give buyers a meaningful UI message. |
| EXCH-DESIGN-04 | Decide and document policy for multiple `sent` requests on same `INTEREST_RECEIVED` listing. |

---

## 7  Architecture Summary

```
Boundary                Layer                         State of Guard
─────────────────────   ──────────────────────────    ─────────────────────────────────────────
HTTP entry              Idempotency middleware        ✅ composite key, sentinel, replay
HTTP entry              JWT auth + CSRF               ✅ httpOnly refresh, SameSite=strict
Request validation      Zod schemas                   ✅ all input validated before handlers
Event authorization     authorizeEvent()              ✅ buyer/seller/admin gates before FSM
FSM transition          createRequestMachine()        ✅ throws InvalidTransitionError
FSM transition          createListingMachine()        ✅ used in listingService; bypassed in side-effects ⚠️
FSM transition          createDisputeMachine()        ✅
Concurrency             SELECT … FOR UPDATE           ✅ request, dispute rows; ⚠️ listing row unchecked inside updateRequestEvent side-effects
Atomicity               prisma.$transaction()         ✅ all multi-table writes
Optimistic lock         version counter               ✅ checked and bumped on every event
Trust computation       computeTrust()                ✅ deterministic, sanitised inputs
Restriction check       RestrictionEngine             ✅ called at createListing, createRequest
Audit trail             tx.auditLog.create()          ✅ every FSM event, rollback-safe
Counter accuracy        updateMany / increment        ✅ both parties on complete; actor on cancel; ⚠️ WITHDRAWN not counted
Idempotency on crash    sentinel cleanup on 5xx       ❌ sentinel stuck at 102
RESOLVED terminal       TERMINAL_STATUSES             ❌ RESOLVED missing
Listing API coverage    STATUS_TO_EVENT               ❌ FLAG/EXPIRE/ARCHIVE/REMOVE missing
```
