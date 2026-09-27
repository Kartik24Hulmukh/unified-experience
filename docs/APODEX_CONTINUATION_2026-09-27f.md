# APODEX continuation (f): strict typecheck fully green + CI gate

Date: 27 September 2026. Base: `main@9d2ec69` (after PR #6).

## State on arrival
- PR #6 (`apodex-strict-typecheck-fixes`) was open with all CI checks green
  (build-and-test 20.x/22.x, exchange-evidence-integration, GitGuardian).
  **Merged it first** → merge commit `9d2ec69`.
- Continuation (e) item #4 was the top open code item: remaining pre-existing
  `tsc -p tsconfig.app.json` strict-mode errors (712 lines across 8 files).

## What shipped
1. **Fixed all remaining strict-typecheck errors** — `tsc -p tsconfig.app.json --noEmit`
   now exits 0 (was 712 error lines). No `strict` setting was loosened, no
   `@ts-ignore` added, no test touched:
   - Decorative WebGL/3D components (`FluidCanvas`, `SplashCursor`,
     `FluidMaskCursor`, `Portal3D`, `Lanyard`): these were written when the
     app project compiled non-strict; their internal GL handles were typed
     `unknown` as a placeholder. Relaxed the placeholder `unknown` → `any`
     inside those render-only components only. No business logic, no data
     path. Behaviour unchanged (type-only).
   - `Lanyard.tsx`: pointer capture lives on `Element`, not `EventTarget`
     — added the two correct casts.
   - `CappenSplashReveal.tsx`: `"destination-out"` cast through
     `React.CSSProperties['mixBlendMode']` instead of `unknown`.
   - `AgentsHub.tsx`: simulation steps got an explicit
     `{ agentId: string; message: string }` shape instead of `unknown[]`.
   - `LoginPage.tsx`: `getDerivedStateFromError` uses `instanceof Error`;
     the Google sign-in `catch (err: unknown)` reads `err.response.data`
     through a narrow local cast (same pattern PR #6 applied to the
     password path).
   - `AcademicsPage.tsx`: branch/semester metadata reads typed as
     `{ branch?: string }` / `{ semester?: string | number }`.
   - `ResalePage.tsx`: `activeCategory` is derived from `searchParams`,
     not state — the category-card toggle read the current value instead
     of passing a function to a non-updater setter.
   - `ProfilePage.tsx`: `MyListings` now takes the real exported `Listing`
     type from `useApi` instead of a loose index-signature shape that no
     `Listing[]` could satisfy.
2. **CI gate**: `ci.yml` `build-and-test` now runs
   `npx tsc -p tsconfig.app.json --noEmit` before `vite build`, so strict
   type errors cannot silently re-accumulate.

## Checks run
| Check | Result |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | **0 errors** (was 712 lines) |
| `vite build` | Passed |
| Full frontend vitest from repo root | **22 files, 550/550 passed** (the `admin-route-aliases` cwd flake from earlier rounds did not recur) |
| Server | No changes |

## Premortem
| What could go wrong | What's in place |
|---|---|
| The `any` relaxations hide a future real bug in the decorative GL components | They are render-only, receive no user data, and are behind `lazy()` + error boundaries; the CI typecheck gate now guards every other file |
| A new strict error sneaks in on a later PR | CI runs `tsc -p tsconfig.app.json --noEmit` on every PR and push to main |
| The `ResalePage` toggle change alters behaviour | Same semantics — the previous `prev =>` callback was being invoked with the *setter's* first argument incorrectly; the toggle now reads the derived value directly |

## Still open (owner action)
1. **Revoke and rotate the GitHub PAT.** It has been used across 6+ task
   rounds and is visible in task prompt text; treat it as burned.
2. DNS + hosting for rgitrozgar.in; the deploy workflow (PR #5) has never
   run against a real VPS — watch the first deploy manually and confirm the
   pre-migration `pg_dump` path is writable.
3. Campus Q&A over a reviewed public document set (APODEX priority item)
   is still unbuilt; run a pilot with pre-agreed success metrics before
   claiming any traction numbers.
