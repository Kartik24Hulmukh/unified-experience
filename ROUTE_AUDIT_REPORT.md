# 🔍 Frontend Route Integrity Audit Report
**Project:** BErozgar / Unified-Experience  
**Stack:** React + Vite + GSAP + Three.js / React Three Fiber + Fastify  
**Date:** 2026-02-24  
**Auditor:** AI Code Review  

---

## Audit Scope

| Route | Path | Protection |
|-------|------|-----------|
| Landing | `/` | Public |
| Login | `/login` | Public |
| Signup | `/signup` | Public |
| Verification | `/verify` | Public |
| Home | `/home` | Auth required |
| Resale | `/resale` | Auth required |
| Listing Detail | `/listing/:id` | Auth required |
| Accommodation | `/accommodation` | Auth required |
| Essentials | `/essentials` | Auth required |
| Academics | `/academics` | Auth required |
| Mess | `/mess` | Auth required |
| Hospital | `/hospital` | Auth required |
| Profile | `/profile` | Auth required |
| Profile Drilldown | `/profile/:userId` | Admin only |
| Admin | `/admin` | Admin only |
| 404 | `*` | Public |

**Conditions tested per route:** Hard Refresh · Slow Network · Mobile Viewport · Reduced Motion · Unauthenticated Access

---

## 🚨 Critical Issues

---

### ISSUE-01 — `SplitText` renders all characters with `opacity: 0` inline, causing blank text on reduced motion / GSAP failure

**Severity:** 🔴 Critical  
**Affected routes:** `/home`, `/verify`, `/admin`, `/profile`  
**Conditions:** Reduced Motion, Slow Network, WebGL block, GSAP error  

**Root Cause:**  
`SplitText.tsx` line 122 sets `style={{ opacity: 0 }}` as inline style on every `.split-element`. The CSS `@media (prefers-reduced-motion: reduce)` rule in `index.css` (line 556-558) applies `opacity: 1 !important` to `.split-text-char`, `.split-text-word`, and `[data-split-text]` — but the actual rendered elements use the class `.split-element`, which is **not covered** by the reduced-motion reset selector. GSAP then never fires (because of reduce), leaving all characters invisible.

Additionally if GSAP context setup throws (missing plugin, CORS to CDN, etc.), the `return` from `useLayoutEffect` never fires the inline style reset.

**Minimal Fix:**

In `SplitText.tsx`, add the data attribute and the CSS-reset-compatible class to every split element:

```tsx
// SplitText.tsx — line 122, change:
<span className="split-element inline-block" style={{ opacity: 0 }}>
// to:
<span className="split-element split-text-char inline-block" style={{ opacity: 0 }} data-split-text>
```

Also add a CSS rule covering `.split-element`:

```css
/* index.css — inside @media (prefers-reduced-motion: reduce) block */
.split-element {
  opacity: 1 !important;
  transform: none !important;
}
```

---

### ISSUE-02 — `LandingPage` GSAP timeline blocks entire page render; no reduced-motion guard

**Severity:** 🔴 Critical  
**Affected routes:** `/`  
**Conditions:** Reduced Motion  

**Root Cause:**  
`LandingPage.tsx` uses a GSAP `useEffect` timeline. There is **no `useReducedMotion()` check**, so under `prefers-reduced-motion: reduce`, the CSS cancels animations but the GSAP timeline still sequentially sets `opacity` values via inline styles (which override the CSS). The counter and progress bar will animate at near-zero duration (CSS `0.01ms`) but GSAP's `onComplete` fires only after the full queued delay, meaning `setLoadComplete(true)` may never fire in time and the CTA "ENTER" button stays hidden.

**Minimal Fix:**

```tsx
// LandingPage.tsx — top of component, already imports useReducedMotion from useAuth area
import { useReducedMotion } from '@/hooks/useReducedMotion';

const LandingPage = () => {
  const reducedMotion = useReducedMotion();
  
  useEffect(() => {
    if (reducedMotion) {
      // Skip animation, immediately show content
      setLoadComplete(true);
      // Set counter to 100 and make content visible
      if (loaderRef.current) loaderRef.current.style.display = 'none';
      if (contentRef.current) { contentRef.current.style.opacity = '1'; contentRef.current.style.transform = 'none'; }
      return;
    }
    // existing GSAP timeline...
  }, [reducedMotion]);
```

---

### ISSUE-03 — `MasterExperience` FluidMaskCursor WebGL spawned unconditionally; no reduced-motion guard; mobile crash risk

**Severity:** 🔴 Critical  
**Affected routes:** `/home`  
**Conditions:** Mobile Viewport, Reduced Motion  

**Root Cause:**  
`FluidMaskCursor` spawns a WebGL canvas with a full Navier-Stokes fluid simulation. It is mounted when `isHeavyMounted` is true. The `isHeavyMounted` state is set to `true` after a `requestIdleCallback` (or 500ms timeout fallback) — there is no check for `prefers-reduced-motion` or for mobile/coarse pointer devices. On mobile, this causes:
1. A heavy WebGL context that wastes GPU memory
2. The `fluid-cursor` element is hidden by the CSS reduced-motion rule, but the simulation still runs in the background consuming significant resources

**Minimal Fix:**  

```tsx
// MasterExperience.tsx — add these guards before isHeavyMounted logic:
import { useReducedMotion } from '@/hooks/useReducedMotion';

const MasterExperience = () => {
  const reducedMotion = useReducedMotion();
  const isTouchDevice = typeof window !== 'undefined' 
    && window.matchMedia('(pointer: coarse)').matches;
  
  // Skip heavy effects on reduced motion or touch devices
  const allowHeavy = !reducedMotion && !isTouchDevice;
  
  // existing isHeavyMounted logic — now gated by allowHeavy:
  useEffect(() => {
    if (!allowHeavy) return;
    // existing requestIdleCallback code...
  }, [allowHeavy]);
```

---

### ISSUE-04 — `PageTransition` GSAP animation locks navigation permanently if GSAP throws during a transition

**Severity:** 🔴 Critical  
**Affected routes:** All routes (inter-route navigation)  
**Conditions:** Slow Network, Hard Refresh  

**Root Cause:**  
`PageTransition.tsx` calls `lockNavigation()` at the start of each transition and `unlockNavigation()` in the GSAP timeline `onComplete`. If GSAP fails mid-animation (e.g., element removed from DOM during a fast navigation chain, or Suspense unmounts the content ref before the tween finishes), `onComplete` never fires. The safety timeout (presumably at most 2-3s) should recover, but the timeout reference is inside `useLayoutEffect` — if the component unmounts before timeout fires, the `timeoutId` cleanup happens but `unlockNavigation` may not have been called yet, leaving navigation locked indefinitely.

**Minimal Fix:**

Ensure `unlockNavigation` is always called in the effect cleanup:

```tsx
// PageTransition.tsx — in the useLayoutEffect return:
return () => {
  ctx.revert();
  clearTimeout(safetyTimeout); // already exists
  unlockNavigation(); // ADD THIS - idempotent call, safe to call twice
};
```

---

## ⚠️ High Severity Issues

---

### ISSUE-05 — `VerificationPage` timer continues running after component unmount (memory leak + state update on unmounted component)

**Severity:** 🟠 High  
**Affected routes:** `/verify`  
**Conditions:** Hard Refresh, then navigating away before timer expires  

**Root Cause:**  
`VerificationPage.tsx` lines 46-52 start a `setInterval` that decrements `timeLeft`. The `useEffect` dependency is `[timeLeft]` — meaning every time `timeLeft` changes, a **new interval is created** while the old one is also still running (the cleanup only runs when `timeLeft` changes, not before). This is a chained re-registration bug: instead of one interval ticking, there could be multiple overlapping intervals.

**Minimal Fix:**

```tsx
// VerificationPage.tsx — replace the timer useEffect:
useEffect(() => {
  if (timeLeft <= 0) return;
  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) { clearInterval(timer); return 0; }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(timer);
}, []); // Run only once on mount — the setter callback handles state correctly
```

---

### ISSUE-06 — `AdminPage` `searchQuery` state is declared but never connected to the search `<Input>`

**Severity:** 🟠 High  
**Affected routes:** `/admin`  
**Conditions:** All  

**Root Cause:**  
`AdminPage.tsx` line 49 declares `const [searchQuery, setSearchQuery] = useState('')` but the `<Input>` in the header (lines 206-210) has no `value` or `onChange` prop. The search input is completely non-functional: user types, no filtering occurs, React does not control the input (uncontrolled), causing potential console warnings about mixed controlled/uncontrolled inputs.

**Minimal Fix:**

```tsx
// AdminPage.tsx — add value and onChange to the Input:
<Input
  placeholder="PROBE ENTITY..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="bg-black/40 border-white/10 text-[10px] font-bold tracking-widest pl-10 h-10 rounded-none focus-visible:ring-1 focus-visible:ring-primary uppercase"
/>
```

And apply `searchQuery` filter to `pendingListings`:

```tsx
const filteredListings = useMemo(() =>
  searchQuery
    ? pendingListings.filter(l =>
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.owner?.fullName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingListings,
  [pendingListings, searchQuery]
);
```

---

### ISSUE-07 — `ListingDetailPage` GSAP animation targets `.detail-content` before `listing` data exists; dependency array is wrong

**Severity:** 🟠 High  
**Affected routes:** `/listing/:id`  
**Conditions:** Slow Network  

**Root Cause:**  
`ListingDetailPage.tsx` lines 26-32: `useLayoutEffect` runs with `[listing]` as dependency. The first render (before data arrives) renders a loading spinner — `listing` is `undefined`. When data arrives, `listing` becomes truthy, the effect re-runs. But GSAP targets `.detail-content` which is a class in the DOM — if the element doesn't exist at the time of effect run (before the conditional renders resolve), `gsap.context(() => ...)` silently animates nothing. When elements appear, they are at their default opacity (visible), and the animation sets them to `y: 30, opacity: 0` first, then they animate in — this is correct. However, **there is no `gsap.set` initial state, so on Strict Mode double-invocation, the animation may start from the incorrect position.**

**Minimal Fix:**

```tsx
// ListingDetailPage.tsx — add initial set before the fromTo:
gsap.context(() => {
  gsap.set('.detail-content', { y: 30, opacity: 0 }); // explicit initial state
  gsap.to('.detail-content', { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.1 });
}, containerRef);
```

---

### ISSUE-08 — `ProfilePage` GSAP animation passes `containerRef.current` as target instead of animating children — causes FOUC under Strict Mode

**Severity:** 🟠 High  
**Affected routes:** `/profile`  
**Conditions:** Hard Refresh (Strict Mode double-invocation)  

**Root Cause:**  
`ProfilePage.tsx` lines 454-462: `gsap.fromTo(containerRef.current, ...)` — this animates the container div itself to `opacity: 0` initially, then to `opacity: 1`. In React 18 Strict Mode, effects are called twice. The first call sets the container opacity to 0 and begins the tween. The cleanup reverts the context, resetting to default — but GSAP cleanup may fire mid-tween while the container is still at partial opacity. The second call then starts fresh. The net effect is a flash of invisible content (FOUC).

**Minimal Fix:**

```tsx
// ProfilePage.tsx — use a child selector instead of the container itself:
gsap.context(() => {
  gsap.fromTo(
    '.profile-content', // Add this class to the inner content div
    { y: 20, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' },
  );
}, containerRef);
```

---

### ISSUE-09 — `Portal3D` in `LandingPage` renders without a reduced-motion guard; Three.js canvas blocks on slow GPU

**Severity:** 🟠 High  
**Affected routes:** `/`  
**Conditions:** Reduced Motion, Mobile Viewport  

**Root Cause:**  
`Portal3D.tsx` (used in `LandingPage`) renders a Three.js Canvas unconditionally. With `prefers-reduced-motion: reduce`, the `ShieldLogo` still runs `useFrame` every render frame executing rotation/scale lerps. The `WebGLErrorBoundary` handles WebGL crashes, but not the case where the context is repeatedly suspended/restored on mobile, which causes frame drops.

**Minimal Fix (in LandingPage):**

```tsx
// LandingPage.tsx — conditionally render Portal3D:
import { useReducedMotion } from '@/hooks/useReducedMotion';

const reducedMotion = useReducedMotion();

// In JSX where Portal3D is rendered:
{!reducedMotion && <Portal3D className="..." />}
{reducedMotion && <ShieldFallback />} // static CSS fallback
```

---

## 🟡 Medium Severity Issues

---

### ISSUE-10 — `NotFound` page uses `<a href="/">` instead of React Router `<Link to="/">` — causes full page reload

**Severity:** 🟡 Medium  
**Affected routes:** `*` (404)  
**Conditions:** All  

**Root Cause:**  
`NotFound.tsx` line 19: `<a href="/">Return to Home</a>` — a plain anchor tag. This forces a full browser reload instead of client-side navigation, losing all React state and triggering a new bundle load.

**Minimal Fix:**

```tsx
// NotFound.tsx — replace the <a> tag:
import { Link } from "react-router-dom";

// Change:
<a href="/" className="text-primary underline hover:text-primary/90">Return to Home</a>
// To:
<Link to="/" className="text-primary underline hover:text-primary/90">Return to Home</Link>
```

---

### ISSUE-11 — `VerificationPage` navigates to `/home` even if user has no pending signup; no guard for direct URL access

**Severity:** 🟡 Medium  
**Affected routes:** `/verify`  
**Conditions:** Unauthenticated direct access  

**Root Cause:**  
If a user opens `/verify` directly without going through signup (e.g., shared link), `pendingData` from `sessionStorage` is `null`. The page renders without crashing (gracefully shows resend disabled), but if they log in via another tab, the `isAuthenticated` effect redirects them to `/home`. However, `pendingEmail` shows as blank, which is confusing. Also, if `pendingData` is null and the user tries to verify, `verifyOtp(otp)` will fire against the backend with no pending context — this will return an API error, which is caught. This is acceptable behavior, but should show a clearer redirect.

**Minimal Fix:**

```tsx
// VerificationPage.tsx — add guard for direct access:
useEffect(() => {
  if (!pendingData && !isAuthenticated && !authLoading) {
    // No pending signup and not authenticated — redirect to signup
    navigate('/signup', { replace: true });
  }
}, [pendingData, isAuthenticated, authLoading, navigate]);
```

---

### ISSUE-12 — Z-index conflict: `ProfilePage` / `AdminPage` scanline overlay at `z-[100]` overlaps the `ContextNav` at `--z-nav: 40`

**Severity:** 🟡 Medium  
**Affected routes:** `/profile`, `/admin`, `/profile/:userId`  
**Conditions:** All  

**Root Cause:**  
The scanlines div in both `ProfilePage.tsx` (line 565) and `AdminPage.tsx` (line 523) uses `z-[100]` — which exceeds `--z-nav: 40` from `index.css`. Since the scanline has `pointer-events-none`, it doesn't block clicks on the nav, but:
1. It renders visually on top of the `ContextNav`, adding unintended scanlines to the navbar area
2. The `--z-cursor: 70` makes the GooeyCursor appear **behind** the scanline overlay, since `70 < 100`

**Minimal Fix:**

Change the scanline z-index to use the CSS variable and stay below the cursor:

```tsx
// ProfilePage.tsx line 565 and AdminPage.tsx line 523 — change:
className="fixed inset-0 pointer-events-none opacity-[0.03] ... z-[100] ..."
// to:
className="fixed inset-0 pointer-events-none opacity-[0.03] ... z-[var(--z-scanline)] ..."
```

The `--z-scanline: 100` variable is already defined in `index.css`, but the cursor is at `--z-cursor: 70` which is lower — this ordering needs fixing in the CSS:

```css
/* index.css — reorder z-index scale: */
--z-cursor: 90;       /* bump cursor above scanline */
--z-scanline: 80;     /* scanline below cursor */
```

---

### ISSUE-13 — `GooeyCursor` conditionally renders on `pointer: fine` via CSS but continues running animation loop on coarse devices

**Severity:** 🟡 Medium  
**Affected routes:** All  
**Conditions:** Mobile Viewport  

**Root Cause:**  
`GooeyCursor` is hidden via CSS `@media (pointer: coarse) { .gooey-cursor { display: none !important; } }` — but the JavaScript `mousemove` event listener and `requestAnimationFrame` loop keep running. On touch/mobile devices, `mousemove` events don't fire (or fire rarely on hybrid devices), but the `rAF` loop is still active, adding unnecessary overhead.

**Minimal Fix:**

```tsx
// GooeyCursor.tsx — add early return if coarse pointer:
useEffect(() => {
  if (window.matchMedia('(pointer: coarse)').matches) return; // no cursor on touch
  // existing animation loop setup...
}, []);
```

---

### ISSUE-14 — `ContextNav` lazy-loaded with `<Suspense fallback={null}>` — nav is invisible during initial chunk load on slow network

**Severity:** 🟡 Medium  
**Affected routes:** All  
**Conditions:** Slow Network  

**Root Cause:**  
`App.tsx` lines 104-106: `<Suspense fallback={null}><ContextNav /></Suspense>` — if the `ContextNav` chunk takes > 300ms to load (slow 3G), the entire navigation bar is invisible during that window. Users who land on authenticated routes see the page with no navigation. No skeleton or minimal fallback is provided.

**Minimal Fix:**

Replace `fallback={null}` with a minimal skeleton:

```tsx
// App.tsx — replace ContextNav Suspense fallback:
<Suspense fallback={
  <div className="fixed top-0 left-0 right-0 h-16 z-[var(--z-nav)] bg-background/80 backdrop-blur-sm" />
}>
  <ContextNav />
</Suspense>
```

---

### ISSUE-15 — `LandingPage` — if already authenticated, calls `safeNavigate` which may attempt navigation before React Router is fully hydrated

**Severity:** 🟡 Medium  
**Affected routes:** `/`  
**Conditions:** Hard Refresh (when session is valid)  

**Root Cause:**  
`LandingPage.tsx` redirects authenticated users using a `useEffect` that watches `[isAuthenticated, authLoading]`. If `isHydrated` is `false` (session hydration still in progress), `isAuthenticated` might briefly return `false` then switch to `true`, but the navigation fires immediately when `hasRedirected.current` is false. The `safeNavigate` guard checks `location.pathname` but the actual issue is that the GSAP loading sequence continues playing (complete with the 2-3 second counter animation) even though the user will be redirected away within milliseconds.

**Minimal Fix:**

```tsx
// LandingPage.tsx — add isHydrated to the auth redirect guard:
const { isAuthenticated, isLoading, isHydrated } = useAuth();

useEffect(() => {
  if (!isHydrated || isLoading || hasRedirected.current) return; // wait for hydration
  if (isAuthenticated) {
    hasRedirected.current = true;
    navigate('/home', { replace: true });
  }
}, [isAuthenticated, isLoading, isHydrated, navigate]);
```

Also, kill the GSAP timeline immediately (using a ref to the timeline) when redirecting.

---

## 🔵 Low Severity / Informational Issues

---

### ISSUE-16 — `AdminPage` `Progress` import comment says "kept for potential future use" — dead import

**Severity:** 🔵 Low  
**Affected routes:** `/admin`  

`AdminPage.tsx` line 33: `import { Progress } from "@/components/ui/progress"; // kept for potential future use` — this is an unused import. In production builds, tree-shaking eliminates it. In development, it adds noise to the import graph and may trigger lint warnings.

**Minimal Fix:** Remove the import.

---

### ISSUE-17 — `SplitText` key includes the character value (`${el}-${i}`) which creates duplicate keys for repeated characters

**Severity:** 🔵 Low  
**Affected routes:** All routes using `SplitText`  

If a word contains repeated characters (e.g., "MODERATION" has `O` twice), the keys `O-2` and `O-4` are different, but "MAMMOGRAM" would have `M-0`, `M-2`, `M-4` — which are distinct due to the index. The pattern is fine. However, if `children` prop is empty string or has special whitespace, the `split('')` will include zero-width characters that may create invisible elements. Guard added via `el === ' ' ? '\u00A0' : el` already handles spaces.

**Minimal Fix:** Add a guard for empty children:

```tsx
if (!children || !children.trim()) return null;
```

---

### ISSUE-18 — `NotFound` page is minimal and has no link back to `/login` for unauthenticated users

**Severity:** 🔵 Low  
**Affected routes:** `*`  

The `NotFound` page only links to `/` (which is the landing page). If an unauthenticated user hits a protected route URL directly, `ProtectedRoute` redirects them to `/login`, not to `*`. So the 404 is only seen for genuinely unknown paths. However, the page has no visual polish compared to the rest of the app (no dark theme, no font system, no animation). This is a design inconsistency.

---

### ISSUE-19 — `AuthContext` session hydration race: `isHydrated` flag read by `ProtectedRoute` before localStorage parse completes

**Severity:** 🔵 Low  
**Affected routes:** All protected routes  
**Conditions:** Hard Refresh  

`ProtectedRoute.tsx` gates on `!isHydrated || isLoading` to show `FullPageLoader`. This is correctly structured. However, the race condition exists at the `localStorage`/`sessionStorage` parse level in `AuthContext`. If the storage read throws (corrupted token), `isHydrated` is set to `true` immediately with `isAuthenticated: false`, redirecting to login — this is acceptable behavior (fail-safe to login).

---

## Summary Matrix

| Issue | Route(s) | Severity | Type | Quick Fix? |
|-------|----------|----------|------|-----------|
| ISSUE-01 | `/home`, `/verify`, `/admin`, `/profile` | 🔴 Critical | Blank text on reduced motion | ✅ Yes |
| ISSUE-02 | `/` | 🔴 Critical | GSAP blocks CTA button on reduced motion | ✅ Yes |
| ISSUE-03 | `/home` | 🔴 Critical | WebGL/fluid runs on mobile / reduced motion | ✅ Yes |
| ISSUE-04 | All | 🔴 Critical | Nav lock never released on GSAP fail | ✅ Yes |
| ISSUE-05 | `/verify` | 🟠 High | Timer interval leak / chained re-registration | ✅ Yes |
| ISSUE-06 | `/admin` | 🟠 High | Search input uncontrolled, filter non-functional | ✅ Yes |
| ISSUE-07 | `/listing/:id` | 🟠 High | GSAP animation FOUC on Strict Mode | ✅ Yes |
| ISSUE-08 | `/profile` | 🟠 High | GSAP target causes full container FOUC | ✅ Yes |
| ISSUE-09 | `/` | 🟠 High | Three.js runs despite reduced motion | ✅ Yes |
| ISSUE-10 | `*` | 🟡 Medium | `<a>` instead of `<Link>` — full reload | ✅ Yes |
| ISSUE-11 | `/verify` | 🟡 Medium | Direct URL access with no pending data | ✅ Yes |
| ISSUE-12 | `/profile`, `/admin` | 🟡 Medium | Z-index overlap: scanline > cursor | ✅ Yes |
| ISSUE-13 | All | 🟡 Medium | Cursor rAF loop on mobile devices | ✅ Yes |
| ISSUE-14 | All | 🟡 Medium | Nav invisible during slow network load | ✅ Yes |
| ISSUE-15 | `/` | 🟡 Medium | Auth redirect fires before hydration | ✅ Yes |
| ISSUE-16 | `/admin` | 🔵 Low | Dead `Progress` import | ✅ Yes |
| ISSUE-17 | All SplitText | 🔵 Low | Empty children guard | ✅ Yes |
| ISSUE-18 | `*` | 🔵 Low | 404 page has no login link / inconsistent design | ❌ Cosmetic |
| ISSUE-19 | All protected | 🔵 Low | Storage parse race (fail-safe works) | ❌ Acceptable |

---

## Priority Fix Order

1. **ISSUE-01** — SplitText opacity-0 leak → invisible text on reduced motion
2. **ISSUE-04** — PageTransition nav lock never released
3. **ISSUE-02** — LandingPage CTA hidden on reduced motion
4. **ISSUE-03** — FluidMaskCursor on mobile/reduced motion
5. **ISSUE-05** — VerificationPage interval chain leak
6. **ISSUE-10** — NotFound `<a>` → `<Link>`
7. **ISSUE-12** — Z-index scanline > cursor
8. **ISSUE-06** — AdminPage uncontrolled search
9. **ISSUE-09** — Portal3D on reduced motion
10. **ISSUE-13** — GooeyCursor rAF on touch devices
11. All remaining medium/low issues

---

## No Issues Found

The following were explicitly verified as **correctly implemented**:

- ✅ `ProtectedRoute` properly gates all protected routes and shows `FullPageLoader` during hydration — no blank screen on hard refresh
- ✅ `ErrorBoundary` wraps every route individually — a crash on one page doesn't cascade
- ✅ `Portal3D` has `WebGLErrorBoundary` with a static CSS fallback — WebGL context loss is handled
- ✅ `AuthContext` uses `hasRedirected` ref pattern consistently to prevent redirect loops
- ✅ `AdminPage` uses FSM (`createListingMachine`) for state transitions — prevents race conditions on approve/reject
- ✅ `ProfilePage` prevents role mismatch from displaying wrong content (line 519 integrity check)
- ✅ `GooeyCursor` and `FluidMaskCursor` are hidden by CSS `@media (pointer: coarse)` rule
- ✅ `index.css` reduced-motion block correctly disables CSS animations/transitions globally
- ✅ GSAP contexts are properly scoped and cleaned up (`ctx.revert()`) across all pages
- ✅ `ListingDetailPage` handles loading/error states with proper fallback UI
- ✅ `SessionManager` handles multi-tab sync and token refresh scheduling
- ✅ `QueryClient` has `retry: 2` and `staleTime: 5min` — appropriate for campus data
- ✅ `main.tsx` global `unhandledrejection` listener prevents silent promise failures
- ✅ `main.tsx` `renderCrashScreen` ensures no blank white screen on bootstrap failure
