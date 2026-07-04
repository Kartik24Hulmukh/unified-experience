# BEAST ARCHITECT BLUEPRINT: UNIFIED EXPERIENCE SCALE-UP (1K -> 100K Users)
Date: April 14, 2026
Protocol: PAUL (Plan-Apply-Unify Loop)
Context Constraints: OpenSpace (Comms/Data Flow), Claude-Mem (Memory Continuance), Carl (Security/Rules), Base (Core Primitives), Graph (Dependency State).

## 1. THE PLAN: OBJECTIVES & ACCEPTANCE CRITERIA
**Goal 1: React Render & State Optimization (Base & Graph)**
*   **Context:** The app heavily uses Framer Motion, GSAP, Radix UI, React Three Fiber, and Zod. Excessive re-renders drop FPS significantly during 3D/animation bursts.
*   **AC (Acceptance Criteria):** Given a 100k CCU load, When rendering interactive data grids or 3D sequences, Then no component should re-render unless its reactive props structurally mutate (verified via React Profiler & zero unmemoized heavy props).

**Goal 2: State Synchronization & FSM Consistency (Paul & Carl)**
*   **Context:** Current domain and FSM (`src/lib/fsm`, `src/domain`) feel decoupled but leak state updates across unsynced React Contexts.
*   **AC:** Given an atomic state transition in FSM, When the global store updates, Then only deeply subscribed components re-render, with 100% strict schema validation enforcing invariant state.

**Goal 3: Memory Continuance & UX Polish (Claude-Mem & OpenSpace)**
*   **Context:** UI feels "demo-like" with poor loading states, layout shifts, unhandled edge cases, and massive bundle size.
*   **AC:** Given a slow 3G connection, When a user initializes the app, Then critical CSS + JS payload is < 300kb (via code-splitting routes/Three.js chunks). Lazy-loading and graceful skeleton mounting are mandatory.

## 2. STRUCTURAL & DEPENDENCY ANALYSIS (SCAN)
Based on Symbol-level indexing of `vite_react_shadcn_ts` workspace `package.json` and directory structure:

### Paths, Flows, and Features
1.  **Core Interface & Routing (`src/pages`, React Router):** Appears to handle main application routing.
2.  **Visual Engine Framework (`@gsap/react`, `framer-motion`, `@react-three/fiber`):** Drives the immersive layer of the app. This is the primary culprit of the "demo" feel if FPS drops or animations stutter.
3.  **State & FSM (`src/domain`, `src/lib/fsm`):** Custom Finite State Machine orchestrating business logic.
4.  **API/Query (`src/hooks/api`, `@tanstack/react-query`):** Handles remote data fetching, currently at risk of polling exhaustion or cache invalidation thrashing.
5.  **Design System (`src/components/ui`, Tailwind, Radix UI):** Forms the atomic building blocks.

## 3. IDENTIFIED BOTTLENECKS & "DEMO" UI/UX ISSUES
1.  **Monolithic Bundling:** `@react-three/drei`, `three`, `framer-motion`, and `gsap` bundled synchronously cause massive Parse/Compile delays on the main thread.
2.  **Context Thrashing:** Updates in global React Contexts (non-segmented) force cascading tree renders, negating Radix UI's fine-grained DOM performance.
3.  **Lack of Memoization:** Absence of `useMemo` on heavy FSM computations and 3D geometry generations.
4.  **"Demo" Feel:**
    *   Missing staggered/debounced loaders.
    *   No offline fallback or optimistic UI limits.
    *   Absence of robust error boundaries wrapping the WebGL canvas contexts resulting in white-screens on GL crash.

## 4. ACTION PLAN (PAUL LOOP INTEGRATION)

### Phase A: Apply (Execution Breakdown)
*   **Task 1 (Routing & Splitting):** Implement `React.lazy()` for all `src/pages`. Offload `Three.js` models into Suspense Boundaries (`@react-three/fiber` chunks).
*   **Task 2 (State & Memory):** Migrate from sprawling Contexts to discrete Zustand/Jotai atomic slices or strict Context Selectors using `useSyncExternalStore`. Integrate FSM deeply with these atoms.
*   **Task 3 (Data Mutability):** Standardize `@tanstack/react-query` instances. Set aggressive `staleTime`, deduplicate API hooks, and strictly isolate query invalidation keys (`OpenSpace` data boundaries).
*   **Task 4 (UI/UX Polish):** Introduce skeleton layouts that match exact target dimensions (eliminating Cumulative Layout Shift). Enforce strict animation FPS budgets using GSAP's `ticker` optimizations.
*   **Task 5 (Carl Compliance Rule):** Enforce strict `Zod` boundary validation for all input structures traversing from `src/services` into `src/domain` FSM models.

### Phase B: Unify (Scope & Boundaries)
*   *DO NOT TOUCH:* The raw styling properties in Tailwind configs unless unused.
*   *DO NOT TOUCH:* The Playwright E2E suite definitions themselves, but update locator references if DOM tree shifts.
*   *VERIFICATION:* Vitest coverage must remain green (`vitest run --coverage`), and E2E pipelines (`test:e2e`) must succeed against the refactored chunk loading.

**Deploy the Developer Agent to begin Task 1 immediately.**