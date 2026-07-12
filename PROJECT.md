# Project: BErozgar Frontend UI/UX Fixes and Performance Optimization

## Architecture
- **Frontend**: Vite-based React application with TailwindCSS (located in `src/`).
- **Backend**: Fastify server (located in `server/`) using Prisma with SQLite.
- **Assets**: Public assets stored in `public/` and modular imports under `src/assets/`.

## Code Layout
- `src/components/`: Reusable components (e.g. `ContextNav.tsx`, `MasterExperience.tsx`, `Lanyard.tsx`).
- `src/pages/`: Module and page containers (e.g. `AcademicsPage.tsx`, `AccommodationPage.tsx`, etc.).
- `src/index.css`: Global styles, CSS variable definitions.
- `public/`: Uncompiled public assets (images, icons, documents).

## Milestones
| # | Name | Scope | Dependencies | Status | Conv ID |
|---|------|-------|-------------|--------|---------|
| 1 | Asset Optimization & Cleanup | Optimize hero PNGs to WebP, shrink ico/png/apple-touch-icon assets, delete docx, and deduplicate DabbaGo/happyGrub | none | COMPLETED (Worker) | 941131b0-c4ea-4366-92c5-c153b5ae4d40 |
| 2 | Layout & Variable Fixes | Add scrollbar-hide to ContextNav overlay, define --nav-height CSS variable in index.css | none | COMPLETED (Worker) | 941131b0-c4ea-4366-92c5-c153b5ae4d40 |
| 3 | Page Theme Consistency | Apply dark bg-background text-foreground to module page root containers, add pt-[var(--nav-height)] to AccommodationPage | none | COMPLETED (Worker) | 941131b0-c4ea-4366-92c5-c153b5ae4d40 |
| 4 | Card Shimmer & Layout Polish | Add image skeleton/shimmer to MasterExperience, import Academics.jpg as Vite asset, fix ESSENTIALS text clipping | none | COMPLETED (Worker) | 941131b0-c4ea-4366-92c5-c153b5ae4d40 |
| 5 | CLS Stability & Font Preloads | Add width/height to hero images on all 6 pages, add font preloading links to index.html | none | COMPLETED (Worker) | 941131b0-c4ea-4366-92c5-c153b5ae4d40 |
| 6 | Code Cleanup & Frame Perf | Delete FluidTextReveal.tsx, optimize Lanyard.tsx TubeGeometry reuse, remove duplicate overflow-x: clip | none | COMPLETED (Worker) | 941131b0-c4ea-4366-92c5-c153b5ae4d40 |
| 7 | Final Verification & Audit | Build frontend/server, run unit/integration test suites, and perform Forensic Auditor checks | M1-M6 | IN_PROGRESS | 9d87e195-7ed0-443c-94de-dd635baf644f |

## Interface Contracts
- **Module Page Containers**: Standard layout header/padding heights should dynamically derive from `--nav-height`.
- **Card Assets**: Preview images in `MasterExperience.tsx` must be statically imported using Vite's resolving rules (e.g. `@/assets/...`) for cache/optimization.
