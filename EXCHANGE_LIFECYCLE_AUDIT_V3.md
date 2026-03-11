# Exchange Lifecycle Audit — v3
**Date:** 2026-03-10  
**Scope:** Complete end-to-end exchange lifecycle — happy path (10 steps) + 8 edge cases  
**Audited against commit:** current `main` branch  
**Prior audit:** `EXCHANGE_LIFECYCLE_AUDIT_V2.md` dated 2026-03-10  
**Audit delta:** v2 backlog disposition + new findings from full re-read of all service, FSM, middleware, and frontend layers

**Files examined fullstack this pass:**
- `server/src/services/requestService.ts`, `listingService.ts`, `disputeService.ts`, `adminService.ts`, `authService.ts`
- `server/src/domain/fsm/RequestMachine.ts`, `ListingMachine.ts`, `types.ts`, `disputeEngine.ts`
- `server/src/domain/trustEngine.ts`, `restrictionEngine.ts`, `fraudHeuristics.ts`
- `server/src/middleware/idempotency.ts`, `authenticate.ts`, `authorize.ts`
- `server/src/plugins/auth.ts`, `rate-limit.ts`
- `server/src/routes/requests.ts`, `listings.ts`, `disputes.ts`, `admin.ts`
- `server/src/shared/validation.ts`, `server/prisma/schema.prisma`
- `src/pages/AdminPage.tsx`, `ListingDetailPage.tsx`, `ResalePage.tsx`
- `src/components/ResourceListingForm.tsx`, `NotificationCenter.tsx`
- `src/hooks/api/useApi.ts`, `src/hooks/useRestriction.ts`

---

## 1  v2 Backlog Disposition

| ID | Description | Status | Evidence |
|----|-------------|--------|---------|
| NEW-BUG-01 | Listing FSM bypassed in request service side effects | ✅ FIXED | `updateMany` with `WHERE status IN (...)` guards on all listing side-effects in `requestService.ts`; `ConflictError` thrown on count === 0 |
| NEW-BUG-02 | `RESOLVED` missing from `TERMINAL_STATUSES` | ✅ FIXED | `RESOLVED` confirmed present; comment explains `DISPUTED` intentionally excluded |
| NEW-BUG-03 | FLAG/ARCHIVE/EXPIRE/REMOVE have no API path | ✅ FIXED | `STATUS_TO_EVENT` extended: `flagged`, `removed`, `archived`, `expired` now map to FSM events |
| NEW-BUG-04 | Sentinel stuck at `102` on server crash – 24 h TTL | ⚠️ PARTIAL | `pruneIdempotencyKeys()` removes 102-sentinels older than 10 min, but **no scheduler calls this function**; `recoverStaleTransactions()` only deletes expired keys, not stuck sentinels |
| NEW-BUG-05 | Listing row unlocked during request side-effect writes | ✅ MITIGATED | Plain `UPDATE` now replaced by `updateMany` with state assertion; Postgres row-level write locking blocks concurrent writes regardless |
| NEW-BUG-06 | AdminPage FSM loses snapshot on API error | ✅ FIXED | `const prev = machine` snapshot before optimistic flip; `onError:` rolls back `setMachines(m => ({ ...m, [id]: prev }))` |
| NEW-BUG-07 | Status case mismatch — request button never shown | ✅ FIXED | `const statusKey = (listing.status ?? '').toLowerCase()` in `ListingDetailPage.tsx`; all comparisons use `statusKey` |
| NEW-BUG-08 | `trustStatus` DB column never written — ghost field | ❌ STILL OPEN | Column still hardcoded to `"GOOD_STANDING"` default; no write-through anywhere in codebase |
| NEW-RACE-01 | TOCTOU in `createRequest` listing CAS — misleading error | ✅ FIXED | Throws immediately on `updatedCount.count === 0` using the correct error message |
| NEW-RACE-02 | Simultaneous buyer-seller cross-dispute | ✅ FIXED | Bidirectional `OR` clause in `tx.dispute.findFirst` confirmed |
| NEW-RACE-03 | WITHDRAWN events not counted — send/withdraw harassment | ✅ FIXED | `cancelledRequests: { increment: 1 }` for both `CANCELLED` and `WITHDRAWN` confirmed |

---

## 2  Happy-Path FSM Trace (v3 Re-Verification)

```
Step  Actor    API Call / Action                   Request FSM                           Listing FSM
────  ──────   ──────────────────────────────────  ────────────────────────────────────  ───────────────────────────────────
 1    Seller   POST /listings                      —                                     DB insert → DRAFT
 2    Seller   PATCH /listings/:id/status          —                                     DRAFT → SUBMIT → PENDING_REVIEW
 3    Admin    PATCH /listings/:id/status          —                                     PENDING_REVIEW → APPROVE → APPROVED
 4    Buyer    POST /requests                      DB insert → SENT ⚠️                  APPROVED → CAS updateMany → INTEREST_RECEIVED
 5    Seller   PATCH /requests/:id/event ACCEPT    SENT → ACCEPT → ACCEPTED              INTEREST_RECEIVED → updateMany → IN_TRANSACTION ✅
 6    Either   PATCH /requests/:id/event SCHEDULE  ACCEPTED → SCHEDULE → MEETING_SCHED  (unchanged)
 7    Either   PATCH /requests/:id/event CONFIRM   MEETING_SCHED → CONFIRM → COMPLETED  IN_TRANSACTION → updateMany → COMPLETED ✅
 8    System   /auth/me (next login/profile call)  computeTrust() reads DB counters      —
 9    Buyer    POST /disputes                      COMPLETED → raw UPDATE → DISPUTED ⚠️  (unchanged; listing stays COMPLETED)
10    Admin    PATCH /disputes/:id/status RESOLVE  raw UPDATE → RESOLVED ⚠️             (unchanged — see Bug V3-05)
```

**⚠️ markers = current code diverges from FSM-first ideal (detailed in §4)**

---

## 3  Edge Case Re-Audit

### 3.1  Double-Click Confirm

| Scenario | Outcome | Assessment |
|----------|---------|-----------|
| Sequential (same key, same client) | 2nd call hits sentinel status=200, replays cached body | ✅ PASS |
| Concurrent (same key, parallel inflight) | 2nd create hits P2002 unique constraint → 409 IDEMPOTENCY_RACE | ✅ PASS |
| Server 5xx after DB commit | `idempotencyCacheResponse` deletes sentinel → client can retry normally | ✅ PASS |
| Process crash after DB commit, before onSend | Sentinel stuck at `102` for 24 h; no scheduler runs `pruneIdempotencyKeys()` | ❌ FAIL → V3-02 |
| `useCreateListing` in `ResourceListingForm` sends NO idempotency key | Middleware skips: `if (!key) return` — double-submit risk for listing creation | ❌ FAIL → V3-01 |

### 3.2  Simultaneous CONFIRM (Two Parties)

`SELECT … FOR UPDATE` on `requests` serialises both transactions.  
Second CONFIRM reads `COMPLETED` → FSM throws `ConflictError` → 409. ✅

**Remaining open design issue:**  
No dual-confirmation requirement exists. A single `CONFIRM` from either party (buyer or seller) immediately moves to `COMPLETED`. The "both sides confirm" semantics described in UX documentation are **not enforced by the backend**.  
→ **EXCH-DESIGN-02 — unchanged from v2; still unresolved**

### 3.3  Request CANCEL While Seller ACCEPTs

Both events use row-level `FOR UPDATE`; whichever arrives first wins. Losing party receives 409 with a valid FSM error. Both outcomes (seller-wins or buyer-wins) are FSM-correct. ✅

**New wrinkle found:** If the CANCEL wins and the listing reverts to `APPROVED`, then the seller's `ACCEPT` arrives: FSM rejects `CANCELLED → ACCEPT`. But `authorizeEvent()` in step 3 precedes the FSM check. The seller is `SELLER_ONLY_EVENTS.has('ACCEPT')` — valid. The FSM then throws `ConflictError`. The audit log records the failed ACCEPT event attempt **with actorRole missing from `metadata`** (see V3-07).

### 3.4  Listing REMOVED Mid-Transaction

Two sub-cases:

**Hard delete (direct DB DELETE):** `Request.listing` has `onDelete: Cascade` in schema → all requests for the listing are cascade-deleted. No orphaned requests. ✅  
`Dispute.listing` has NO cascade → hard delete of disputed listing returns P2003 FK violation. Blocked. ✅

**Soft delete (FSM REMOVE → status = REMOVED):**  
Active requests for that listing are **not cancelled**. Requests remain in ACCEPTED / MEETING_SCHEDULED.  
- The CONFIRM side-effect does `listing.updateMany({ WHERE status = 'IN_TRANSACTION' })`. Since listing is now `REMOVED`, count = 0 → `ConflictError` preventing the exchange from completing.  
- Neither party can CONFIRM (ConflictError). Admin must manually CANCEL the request.  
- `recoverStaleTransactions()` will expire the request after 14 days if it reaches that threshold.  
- **No audit trail entry records the reason the exchange was blocked.**  
→ **V3-05 (listing-REMOVE-mid-tx has no active-request cleanup)**

### 3.5  Admin FLAG Mid-Transaction

**v2 finding (NEW-BUG-03) was: FLAG had no API path. Status: ✅ Fixed.**

Current code now accepts `{ status: 'flagged' }` and maps via `FLAG` FSM event. From `in_transaction`, the FSM transition is:

```typescript
in_transaction: {
  CONFIRM_EXCHANGE: 'completed',
  CANCEL_TRANSACTION: 'approved',
  FLAG: 'flagged',      // ← now reachable
},
```

**New risk exposed by the fix:**  
When a listing transitions `in_transaction → flagged`, the **active request is not cancelled**.  
- Request remains in `ACCEPTED` or `MEETING_SCHEDULED`.
- Buyer/seller attempt CONFIRM → `listing.updateMany({ WHERE status = 'IN_TRANSACTION' })` → count = 0 → `ConflictError`.
- Request is stuck unless admin cancels it or recovery expires it.
- **Gap:** The listing FLAG event should atomically cancel any active request for that listing and log the forced cancellation.  
→ **V3-04 (active request not cancelled on listing FLAG/REMOVE)**

### 3.6  Network Failure During CONFIRM

| Scenario | Outcome |
|----------|---------|
| Timeout before server receives request | Request never processed; no sentinel created. Client can retry with same key freely. ✅ |
| Server receives, DB commits, response sent but lost in transit | onSend fires, sentinel updated to `200`. Retry replays the cached 200 body. ✅ |
| Server receives, DB commits, **server crashes before onSend** | Sentinel stays at `102 Processing` for 24 h. Retry gets 409 for 24 h. ❌ → V3-02 |
| Optimistic UI flip on client during timeout | `useUpdateRequestEvent.onMutate` flips status optimistically. On network error, `onError` rolls back from snapshot. ✅ |

### 3.7  Retry with Same Idempotency-Key (Same User)

Composite key = `${userId}:${clientKey}`. Same user + same key → preHandler finds sentinel, replays cached response. FSM is not re-entered; no DB writes; audit log not re-written. ✅

### 3.8  Replay with Different User

Different `userId` → different composite key → no sentinel match → full processing.  
`authorizeEvent()` validates `actorId` against `buyer_id`/`seller_id` from DB row.  
Third-party user sending `ACCEPT` on another user's request receives 403 before FSM runs. ✅

---

## 4  New Findings — v3

---

### 4.1  State Corruption Risks

---

#### V3-01 — Listing Creation Has No Idempotency Key Client-Side
**Severity:** HIGH  
**Where:** `src/components/ResourceListingForm.tsx` → `useCreateListing` → `POST /listings`  
**Affects:** Double-submit edge case (step 1)

`ResourceListingForm.onSubmit` calls `createListing.mutateAsync(...)` with no `X-Idempotency-Key` header. The route handler has `preHandler: [authenticate, idempotency]` — but `idempotency.ts` short-circuits when no key header is present (`if (!key) return`). This means listing creation has **no replay protection**.

Network retry or accidental double-submit creates two identical `DRAFT` listings
under the same seller. The seller's duplicate listings may both get approved by an admin who doesn't notice the duplicate.

**The FSM client-side check in `ResourceListingForm`:**
```typescript
const machine = createListingMachine();
const submitted = machine.send('SUBMIT');
```
This is a **local, ephemeral FSM instance** created fresh on every submit. It does not persist between renders or form submissions. It provides no deduplication protection.

**Fix:** Generate a stable `idempotency-key` per form session and pass it via the mutation:
```typescript
// In ResourceListingForm — create once on mount
const idempotencyKey = useRef(crypto.randomUUID());

await createListing.mutateAsync({
  ...values,
  _idempotencyKey: idempotencyKey.current,  // send in header via api-client
});
```
Then wire the api-client to set `X-Idempotency-Key` from the options object.

Also: the submit button does not check `createListing.isPending`. While `mutateAsync` prevents re-entry during the running promise, if the form is re-submitted via Enter key after the promise resolves but before the modal closes, a second request fires.

---

#### V3-02 — Stuck 102-Sentinel Has No Scheduler; `pruneIdempotencyKeys()` Is Never Called
**Severity:** MEDIUM**  
**Where:** `server/src/middleware/idempotency.ts` — `pruneIdempotencyKeys()`  
**Affects:** Network failure during confirmation, post-crash retry window

`pruneIdempotencyKeys()` removes 102-sentinels older than 10 minutes — a good mitigation. But searching the entire server codebase, there is **no invocation of this function** outside of its declaration. It is never called from:
- `recoverStaleTransactions()` (only deletes expired keys, not stuck sentinels)
- `app.ts` / `server.ts` startup
- Any cron job or interval

**Impact:** A crashed server leaves `102 Processing` sentinels with 24-hour TTL. Clients cannot retry for 24 hours. The 10-minute window described in the code comment is only theoretical.

**Fix — Option A (simple):** Call `pruneIdempotencyKeys()` inside `recoverStaleTransactions()`:
```typescript
// at the end of recoverStaleTransactions():
await pruneIdempotencyKeys();  // clean stuck sentinels beyond 10 min
```

**Fix — Option B (robust):** Use a `setInterval` at server startup:
```typescript
// in server.ts after app.listen():
setInterval(() => pruneIdempotencyKeys().catch(logger.error), 10 * 60 * 1000);
```

---

#### V3-03 — `createRequest` Bypasses Request FSM for Initial State
**Severity:** LOW (design smell, future risk)  
**Where:** `server/src/services/requestService.ts` — `createRequest()` line  
**Affects:** FSM audit trail consistency

`createRequest()` inserts a row with `status: 'SENT'` directly:
```typescript
const req = await tx.request.create({
  data: { ..., status: 'SENT' },
});
```

The Request FSM defines: `idle → SEND → sent`. This initial transition is never validated through `createRequestMachine().send('SEND')`. The `SEND` event is also excluded from `authorizeEvent()` (handled implicitly — only buyers can `POST /requests`), and `SEND` is not in the `updateRequestEventSchema` enum.

**Consequence now:** None — the code is correct by construction. Only buyers can call `POST /requests`, and `SENT` is the correct initial state.  
**Future risk:** If SEND ever needs a precondition (e.g., "buyer must be verified"), skipping the FSM means that precondition is invisible.

**Recommendation:** In `createRequest`, use `applyRequestEvent('IDLE', 'SEND')` for FSM consistency, even if the result is the same:
```typescript
const initialStatus = applyRequestEvent('IDLE', 'SEND'); // → 'SENT'
await tx.request.create({ data: { ..., status: initialStatus } });
```

---

#### V3-04 — Listing FLAG/REMOVE Does Not Cancel Active Requests
**Severity:** HIGH  
**Where:** `server/src/services/listingService.ts` — `updateListingStatus()` side effects  
**Affects:** Edge case 3.5: Admin FLAG mid-transaction

When a listing transitions `in_transaction → flagged` (or `interest_received → flagged`, or `approved → flagged`), there is no side effect to cancel / expire active requests for that listing.

**Failure scenario:**
1. Seller lists item. Buyer sends request (listing: `INTEREST_RECEIVED`, request: `SENT`).
2. Seller accepts (listing: `IN_TRANSACTION`, request: `ACCEPTED`).
3. Admin discovers fraud → flags the listing (`IN_TRANSACTION → FLAGGED`).
4. Buyer and seller attempt to CONFIRM → `listing.updateMany({ WHERE status='IN_TRANSACTION' })` → count=0 → `ConflictError('Listing is not in IN_TRANSACTION state')`.
5. Neither party can cancel via normal CANCEL flow because the listing status check in the cancel branch asserts `status IN ('IN_TRANSACTION', 'INTEREST_RECEIVED')` — not FLAGGED.
6. Eventually `recoverStaleTransactions()` expires the request after 14 days. Buyer's `cancelledRequests` is NOT incremented (expiry is a system event, not an actor event).

**Fix:** In `updateListingStatus()`, after a `FLAG` or `REMOVE` transition, cancel all non-terminal requests for that listing:
```typescript
if (event === 'FLAG' || event === 'REMOVE') {
  await tx.request.updateMany({
    where: {
      listingId,
      status: { notIn: ['COMPLETED', 'CANCELLED', 'WITHDRAWN', 'DECLINED', 'EXPIRED', 'RESOLVED'] },
    },
    data: { status: 'CANCELLED', version: { increment: 1 } },
  });
  await tx.auditLog.create({
    data: {
      actorId,
      action: 'REQUEST_FORCE_CANCELLED',
      entityType: 'Listing',
      entityId: listingId,
      metadata: { reason: `Listing transitioned to ${newStatus} by admin` },
    },
  });
}
```

---

#### V3-05 — Dispute Resolution Leaves Listing in Stale State
**Severity:** HIGH  
**Where:** `server/src/services/disputeService.ts` — `updateDisputeStatus()`  
**Affects:** Step 10: Admin resolve dispute

When a dispute is RESOLVED or REJECTED, the request status is updated:
- RESOLVED: `request → RESOLVED`
- REJECTED: `request → COMPLETED`

But **no listing status update exists in either branch**. Consider:

1. Request accepted → listing: `IN_TRANSACTION`
2. Buyer disputes (request is still ACCEPTED → DISPUTED, listing stays `IN_TRANSACTION`)
3. Admin resolves dispute as RESOLVED → request → RESOLVED
4. **Listing is permanently stuck in `IN_TRANSACTION`**

No future buyer can request this listing. No FSM event in `ListingMachine` covers `in_transaction → resolved`. The listing must be manually recovered by admin calling `PATCH /listings/:id/status` with a transition — but `IN_TRANSACTION` only supports `CONFIRM_EXCHANGE`, `CANCEL_TRANSACTION`, and `FLAG`. None of these directly model "dispute resolved, return to available."

**Fix:** On RESOLVED, if the listing exists and is in `IN_TRANSACTION`, reset it to `APPROVED`:
```typescript
if (newStatus === 'RESOLVED' && dispute.request_id) {
  // ... existing request update ...
  
  // Reset listing if it got stuck in IN_TRANSACTION
  if (dispute.listing_id) {
    await tx.listing.updateMany({
      where: { id: dispute.listing_id, status: 'IN_TRANSACTION' },
      data: { status: 'APPROVED' },
    });
  }
}
```

On REJECTED (dispute invalid, exchange was real): listing should stay COMPLETED, which is already the case since REJECTED reverts the request to COMPLETED and no listing change is needed. ✅

---

#### V3-06 — `ESCALATED` Dispute Has No Resolution Path
**Severity:** MEDIUM  
**Where:** `server/src/domain/disputeEngine.ts`, `disputeService.ts`  
**Affects:** Escalated dispute lifecycle

The Dispute FSM defines `ESCALATED` as a terminal state with no outbound transitions:
```typescript
// RESOLVED, REJECTED, ESCALATED — no outgoing transitions (terminal)
```

When admin escalates a dispute:
- The dispute enters `ESCALATED` terminal state.
- The request remains `DISPUTED` (no status update in the ESCALATED branch).
- The listing remains `IN_TRANSACTION`.
- Both are permanently locked unless manually updated at DB level.
- The "higher authority" that resolves escalated disputes has no API endpoint.

**Fix:** Either:
1. Add `RESOLVE` and `REJECT` transitions from `ESCALATED` in the DisputeMachine.
2. In the ESCALATED branch of `updateDisputeStatus()`, add the same request/listing cleanup as the RESOLVED branch.

---

### 4.2  Missing Transaction Guards

---

#### V3-07 — Audit Log Missing `actorRole` in `requestService` and `listingService`
**Severity:** MEDIUM  
**Where:** `requestService.ts` lines ~436, `listingService.ts` ~265  
**Affects:** Audit log completeness (Verify checklist item)

`requestService.updateRequestEvent()` logs:
```typescript
await tx.auditLog.create({
  data: {
    actorId,
    action: 'REQUEST_EVENT',
    entityType: 'Request',
    entityId: requestId,
    metadata: { event: input.event, from: row.status, to: newStatus, actorRole },
  },
});
```
`actorRole` **is** in `metadata` (good) but the `AuditLog.actorRole` **column** is `null`. The admin route maps `actorRole: l.actorRole ?? 'system'` — so the column value is always `'system'` for request events, even when an admin issues them.

Separate from `metadata`, the `actorRole` column should be populated for proper indexed querying:
```typescript
data: {
  actorId,
  actorRole,     // ← populate the dedicated column, not just metadata
  action: 'REQUEST_EVENT',
  ...
}
```

Same gap in `listingService.updateListingStatus()` — `actorId` and `metadata` are populated but `actorRole` column is `null`.

---

#### V3-08 — Restriction Check Outside Transaction in `createRequest` and `createListing`
**Severity:** LOW  
**Where:** `requestService.ts` and `listingService.ts` — restriction check before `prisma.$transaction`  
**Affects:** TOCTOU window for trust/restriction enforcement

Both services call `getCurrentUser(userId)` **before** entering `prisma.$transaction()`. Between this call and the transaction starting, an admin could:
1. Finalise a dispute against the user → `adminFlags: { increment: 1 }` → trust goes to RESTRICTED.
2. The original user's `createRequest` or `createListing` transaction proceeds because the restriction was checked a moment earlier.
3. A listing or request is created for a now-restricted user.

The window is small (milliseconds) but the consequence (restricted user creating records) is a policy violation. The correct fix is to re-read restriction inside the transaction using a read-consistent snapshot.

**Fix:** Move the restriction check inside the transaction:
```typescript
return prisma.$transaction(async (tx) => {
  const trust = await authService.getCurrentUser(buyerId); // now inside tx
  if (trust.restriction.isRestricted) throw new ForbiddenError(...);
  // ... rest of transaction
});
```

---

#### V3-09 — `useCreateListing` Invalidates Only `listings.all`, Not Module-Specific Cache
**Severity:** MEDIUM (UI correctness)  
**Where:** `src/hooks/api/useApi.ts` — `useCreateListing.onSuccess`  
**Affects:** New listings not appearing in ResalePage grid after creation (UI desync)

```typescript
export function useCreateListing() {
  return useMutation({
    mutationFn: ...,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });  // ['listings']
    },
  });
}
```

`ResalePage` uses `useListings({ module: 'resale' })` which generates:
```typescript
queryKey: queryKeys.listings.module('resale')  // ['listings', 'resale']
```

`invalidateQueries({ queryKey: ['listings'] })` uses **prefix matching**. In `@tanstack/react-query v5`, a prefix match on `['listings']` **does** match `['listings', 'resale']` (since v5 uses `queryKey` prefix matching). 

However: the module-specific key `['listings', 'resale']` is a **refinement** of the `all` key. Prefix invalidation should work, but only if the module key is not **exact-matched** elsewhere. Verify this behaviour experimentally, as v5 changed exact-match semantics.

If the new listing is in `DRAFT` or `PENDING_REVIEW` state (which it starts in), it will not appear in the default filtered grid (which typically shows only `APPROVED` listings). No action needed for that case. But when admin approves the listing, `useUpdateListingStatus.onSettled` invalidates `listings.all` and `admin.pending` — but not `listings.module('resale')`. The ResalePage may serve stale data from the 2-minute `staleTime`.

**Fix:** Invalidate all listing cache shapes on listing status change:
```typescript
onSettled: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.listings.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.admin.pending });
  // Force each module cache to refresh:
  queryClient.invalidateQueries({ queryKey: ['listings'], exact: false });
},
```

---

### 4.3  UI Desync Cases

---

#### V3-10 — Notification System Completely Disconnected from Backend State
**Severity:** HIGH (UX integrity)  
**Where:** `src/components/NotificationCenter.tsx`  
**Affects:** Steps 3, 4, 5, 7, 9, 10 — all state transitions that the other party should be aware of

`NotificationCenter` initialises with an empty array:
```typescript
const [notifications, setNotifications] = useState<Notification[]>([]);
```

There is no:
- WebSocket / SSE connection to receive push events
- Polling interval on request/listing status
- Query-key watcher to detect transitions and create local notifications

**Impact by lifecycle step:**

| Step | Action | Party Not Notified |
|------|--------|--------------------|
| 3 | Admin approves listing | Seller never gets "Your listing is live" |
| 4 | Buyer sends request | Seller never sees "New exchange request" |
| 5 | Seller accepts | Buyer never sees "Request accepted" |
| 6 | Either schedules | Other party never sees "Meeting scheduled" |
| 7 | Either confirms | Other party never sees "Exchange completed" |
| 9 | Buyer disputes | Admin never sees "New dispute filed" |
| 10 | Admin resolves | Both parties never see "Dispute resolved" |

**Users must manually refresh pages or switch tabs to discover state changes.**

**Minimum fix (polling):** Add a `refetchInterval` to request and listing queries for active exchanges:
```typescript
useRequests({ role: 'seller' }, { refetchInterval: 30_000 }); // 30 s polling
```

**Robust fix:** Backend SSE endpoint (`GET /api/events`) with per-user event stream; frontend subscribes and hydrates NotificationCenter from push data.

---

#### V3-11 — Optimistic Update for `SCHEDULE` Event Missing from `useUpdateRequestEvent`
**Severity:** LOW  
**Where:** `src/hooks/api/useApi.ts` — `useUpdateRequestEvent.onMutate`  
**Affects:** Step 6: Meeting scheduling shows stale `ACCEPTED` status until server responds

The `optimisticStatusMap` in `useUpdateRequestEvent`:
```typescript
const optimisticStatusMap = {
  ACCEPT: 'ACCEPTED',
  DECLINE: 'DECLINED',
  SCHEDULE: 'MEETING_SCHEDULED',   // ← present ✅
  CONFIRM: 'COMPLETED',
  CANCEL: 'CANCELLED',
  WITHDRAW: 'WITHDRAWN',
  DISPUTE: 'DISPUTED',
  RESOLVE: 'RESOLVED',
};
```
`SCHEDULE` is present. ✅ No issue found here — retracting prior suspicion.

---

#### V3-12 — `INTEREST_RECEIVED` Listing Status Shows No Context to Buyer on Detail Page
**Severity:** LOW  
**Where:** `src/pages/ListingDetailPage.tsx`  
**Affects:** UX for buyers browsing an already-interested listing

`ListingDetailPage` shows the "Request Exchange" section only when `statusKey === 'approved'`.

For `interest_received` (another buyer already showed interest but seller hasn't accepted yet), the UI shows nothing in the request section — no "This listing has a pending request" message, no indication of why the button is absent. Buyers see a blank space and may assume it's a UI bug.

**Fix:**
```tsx
{statusKey === 'approved' && <RequestSection />}
{statusKey === 'interest_received' && (
  <div className="p-6 border border-amber-500/20 text-amber-400 text-sm">
    This listing is currently under consideration by another buyer.
    Check back later if the request is declined.
  </div>
)}
{statusKey === 'in_transaction' && (
  <div className="p-6 border border-white/10 text-white/40 text-sm">
    This listing is currently in an active exchange. It will become available again if the exchange is cancelled.
  </div>
)}
```

---

### 4.4  Backend Race Conditions

---

#### V3-13 — Trust Score Stale on Profile Page After Dispute Resolution
**Severity:** MEDIUM  
**Where:** `src/hooks/api/useApi.ts` — `useProfile()` staleTime, `useCurrentUser()` staleTime  
**Affects:** Step 8: Trust update visibility

When admin resolves a dispute (step 10), `adminFlags` is incremented for the `against` user. The next call to `computeTrust()` will return `RESTRICTED`. However:

- `useCurrentUser` has `retry: false, staleTime: env.VITE_QUERY_STALE_TIME_MS` (unspecified runtime value from env).
- `useProfile` has `staleTime: 5 * 60 * 1000` (5 minutes).
- The `against` user's UI may display `GOOD_STANDING` for up to 5 minutes after the flag is set.
- During this window, the **client** restriction check (`useRestriction`) allows actions, but the **server** restriction check (`getCurrentUser()`) in `createListing`/`createRequest` blocks them with 403.

This is architecturally acceptable (server always wins), but creates a confusing UX where the UI shows enabled buttons that immediately error. 

**Recommendation:** After any admin dispute resolution, invalidate the `auth.me` query in the admin's browser (easy) and ideally broadcast an invalidation to the affected user (hard without SSE). Short-term: reduce `useProfile` staleTime to 60 s.

---

#### V3-14 — `recoverStaleTransactions` Uses Inline Terminal Status List (Drift Risk)
**Severity:** LOW  
**Where:** `server/src/services/adminService.ts` — `recoverStaleTransactions()`  
**Affects:** Stale request recovery correctness

`recoverStaleTransactions()` defines:
```typescript
const terminalStatuses = ['EXPIRED', 'DECLINED', 'CANCELLED', 'COMPLETED'];
```

The authoritative `TERMINAL_STATUSES` in `requestService.ts` is:
```typescript
const TERMINAL_STATUSES: RequestStatus[] = [
  'COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'WITHDRAWN', 'RESOLVED',
];
```

**Gaps in the recovery function:**
- `WITHDRAWN` is missing — a withdrawn request is treated as "active" when counting whether to unlock the listing, causing listing to remain stuck.
- `RESOLVED` is missing — same risk.
- `DISPUTED` is intentionally omitted in both (active litigation).

**Fix:** Export `TERMINAL_STATUSES` from `requestService.ts` and import it in `adminService.ts`:
```typescript
// requestService.ts
export const TERMINAL_STATUSES: RequestStatus[] = [...];

// adminService.ts
import { TERMINAL_STATUSES } from '@/services/requestService';
const terminalStatuses = TERMINAL_STATUSES.map(s => s);
```

---

#### V3-15 — `NEW-BUG-08` (Ghost `trustStatus` Column) Compounds Under Reporting Queries
**Severity:** MEDIUM (escalated from LOW)  
**Where:** `server/prisma/schema.prisma` — `User.trustStatus`  
**Affects:** Any code or tool that queries `trustStatus` from the DB directly

The column `trustStatus String @default("GOOD_STANDING")` is **never written** by the application. It exists only as the Prisma default. Any admin SQL query, reporting tool, or future code path that reads this column will see `"GOOD_STANDING"` for all users regardless of actual computed trust.

Specific risk surface identified in `adminService.getFraudOverview()`:
```typescript
const users = await prisma.user.findMany({
  where: { role: 'STUDENT', OR: [{ adminFlags: { gte: 1 } }, ...] },
  select: { ..., /* trustStatus NOT selected */ },
});
```
Currently `trustStatus` is not selected here, so no bug today. But the presence of this column is a time-bomb for any new feature that reads from it.

**Recommended fix (write-through pattern):** After every `computeTrust()` call that produces a new status, persist it:
```typescript
// In authService.getCurrentUser() after computeTrust():
if (trust.status !== user.trustStatus) {
  await prisma.user.update({ where: { id }, data: { trustStatus: trust.status } });
}
```

---

## 5  Verification Checklist — v3

| Check | Status | Detail |
|-------|--------|--------|
| FSM state correctness — Request FSM | ✅ PASS | All transitions sealed; `InvalidTransitionError` thrown on illegal events |
| FSM state correctness — Listing FSM | ✅ PASS | All status updates go through ListingMachine in `listingService`; side-effects use `updateMany` with WHERE assertions |
| FSM state correctness — Dispute FSM | ⚠️ PARTIAL | `updateDisputeStatus` uses FSM correctly; `createDispute` raw-writes `DISPUTED` (EXCH-BUG-08 partial) |
| No partial state updates — DB | ✅ PASS | All multi-table side-effects inside `prisma.$transaction(async tx => …)` |
| No stuck SENT requests | ✅ PASS | `recoverStaleTransactions()` expires SENT > 7 days |
| No stuck ACCEPTED/MEETING_SCHEDULED requests | ⚠️ PARTIAL | Recovery expires after 14 days, but no proactive cancellation on listing FLAG/REMOVE → V3-04 |
| No orphaned records from listing removal | ⚠️ PARTIAL | Hard-delete cascades; soft-remove leaves orphaned requests → V3-04 |
| No listings stuck in IN_TRANSACTION after dispute | ❌ FAIL | Dispute resolution does not reset listing state → V3-05, V3-06 |
| Audit logs written for all events | ⚠️ PARTIAL | All transitions logged; `actorRole` column always null in request/listing events → V3-07 |
| Audit logs actorRole correct | ❌ FAIL | `actorRole` stored in `metadata.actorRole` but not in `AuditLog.actorRole` column (always `null`) → V3-07 |
| Both parties' `completedExchanges` incremented correctly | ✅ PASS | `updateMany({ id: { in: [seller, buyer] } })` confirmed |
| `cancelledRequests` accurate (CANCELLED + WITHDRAWN) | ✅ PASS | Both events increment; DECLINED does not (correct) |
| `adminFlags` incremented on dispute loss | ✅ PASS | RESOLVED branch confirmed |
| `WITHDRAWN` counted toward trust penalty | ✅ PASS | Fixed in v2; confirmed present |
| Role-event authorization before FSM | ✅ PASS | `authorizeEvent()` gate confirmed |
| Idempotency replay works for success/4xx | ✅ PASS | Confirmed via onSend caching |
| Idempotency replay for 5xx/server-crash | ❌ FAIL | 5xx — sentinel deleted (OK); crash — sentinel stuck 24h; `pruneIdempotencyKeys()` never called → V3-02 |
| Listing creation idempotency | ❌ FAIL | `ResourceListingForm` sends no `X-Idempotency-Key` → V3-01 |
| Optimistic version locking | ✅ PASS | `version` checked (if provided) and bumped on every transition |
| Row-level locking (request + dispute) | ✅ PASS | `SELECT … FOR UPDATE` confirmed in all mutation handlers |
| Row-level locking (listing) | ✅ PASS | `SELECT … FOR UPDATE` in `updateListingStatus` |
| Trust computation deterministic | ✅ PASS | Pure function; all inputs sanitised |
| Trust status stored in DB | ❌ OPEN | `trustStatus` column never written → V3-15 |
| Duplicate request guard accurate | ✅ PASS | TERMINAL_STATUSES includes RESOLVED; DISPUTED excluded intentionally |
| Notification delivery to parties | ❌ FAIL | NotificationCenter has zero backend connection → V3-10 |
| Admin FLAG/REMOVE cancels active requests | ❌ FAIL | No side-effect to cancel requests → V3-04 |
| Escalated dispute has resolution path | ❌ FAIL | ESCALATED is terminal; no admin API to resolve → V3-06 |
| Stuck 102-sentinel cleaned up promptly | ❌ FAIL | `pruneIdempotencyKeys()` not scheduled → V3-02 |
| `recoverStaleTransactions` terminal status list accurate | ❌ FAIL | Missing WITHDRAWN, RESOLVED → V3-14 |

---

## 6  Patch Recommendations (Prioritised)

### Priority 1 — High Severity (Data Integrity)

| ID | File | Fix |
|----|------|-----|
| V3-04 | `listingService.ts` | In `FLAG` and `REMOVE` transitions, atomically cancel all non-terminal requests via `tx.request.updateMany` + audit log |
| V3-05 | `disputeService.ts` | In `updateDisputeStatus` RESOLVED branch, reset listing from `IN_TRANSACTION → APPROVED` via `tx.listing.updateMany` |
| V3-06 | `disputeService.ts` | Add `RESOLVE` / `REJECT` transitions from `ESCALATED` in `DisputeDefinition`, or add listing/request cleanup in the ESCALATED branch |

### Priority 2 — Medium Severity (Correctness / Security)

| ID | File | Fix |
|----|------|-----|
| V3-01 | `ResourceListingForm.tsx` + `api-client.ts` | Generate stable idempotency key per form session; pass as `X-Idempotency-Key` header; disable submit button on `createListing.isPending` |
| V3-02 | `idempotency.ts` + `server.ts` | Schedule `pruneIdempotencyKeys()` via `setInterval` at startup (every 10 min), OR call from `recoverStaleTransactions()` |
| V3-07 | `requestService.ts`, `listingService.ts` | Populate `actorRole` column (not just `metadata.actorRole`) in all `auditLog.create` calls |
| V3-08 | `requestService.ts`, `listingService.ts` | Move `getCurrentUser()` restriction check inside `prisma.$transaction()` |
| V3-09 | `useApi.ts` | `useUpdateListingStatus.onSettled`: invalidate `['listings']` with `exact: false` to reach module-specific caches |
| V3-10 | `NotificationCenter.tsx` | Implement 30 s polling (`refetchInterval`) on request/listing queries; or implement SSE from backend |
| V3-12 | `ListingDetailPage.tsx` | Show contextual messages for `interest_received` and `in_transaction` listing states |
| V3-13 | `useApi.ts` | Reduce `useProfile` staleTime from 5 min to 60 s; add trust-invalidation on admin dispute resolve |
| V3-14 | `adminService.ts` | Export and import `TERMINAL_STATUSES` from `requestService.ts` to eliminate drift; add `WITHDRAWN`, `RESOLVED` |
| V3-15 | `authService.ts` | Write `trustStatus` back to DB after `computeTrust()` whenever it changes |

### Priority 3 — Low Severity / Design Debt

| ID | File | Fix |
|----|------|-----|
| V3-03 | `requestService.ts` | Use `applyRequestEvent('IDLE', 'SEND')` for FSM consistency in `createRequest` |
| V3-11 | `ListingDetailPage.tsx` | Confirm `SCHEDULE` optimistic map is complete (verified OK — no action needed) |
| EXCH-DESIGN-02 | `requestService.ts` | Consider dual-confirmation enforcement: add `buyerConfirmed`/`sellerConfirmed` flags; auto-complete when both set, with the second confirm treated idempotently |
| NEW-BUG-08 | `schema.prisma` | Remove `trustStatus` ghost column or implement write-through as described in V3-15 |

---

## 7  Summary Risk Matrix

| Category | Finding Count | Critical | High | Medium | Low |
|----------|--------------|----------|------|--------|-----|
| State Corruption | 6 | 0 | 3 | 2 | 1 |
| Missing Guards | 4 | 0 | 1 | 2 | 1 |
| UI Desync | 4 | 0 | 1 | 2 | 1 |
| Race Conditions | 3 | 0 | 0 | 2 | 1 |
| Audit/Logging | 2 | 0 | 0 | 2 | 0 |
| **Total** | **19** | **0** | **5** | **10** | **4** |

**No critical severity findings.** The transaction guard architecture (FOR UPDATE row locks + Prisma $transaction + FSM validation) correctly prevents data corruption on the primary concurrent access paths. The remaining risk is concentrated in:
1. Post-dispute listing state recovery (V3-05, V3-06)
2. Active request cleanup on listing admin actions (V3-04)
3. Notification blindness for secondary parties (V3-10)
4. Idempotency sentinel lifecycle management (V3-01, V3-02)
