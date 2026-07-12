# Plan - BErozgar Production Bug Fixes and UI Regressions

This plan outlines the steps the Project Orchestrator and dispatched subagents will take to address requirements R1-R5 and verify the acceptance criteria.

## Phase 1: Exploration & Analysis
- **Goal**: Analyze the current codebase state for each requirement to identify gaps.
- **Subagent**: Spawn `teamwork_preview_explorer` (Conv ID: Explorer_1)
- **Scope**:
  - Inspect `server/Dockerfile` CMD.
  - Inspect MasterExperience dark mode overlays, portal tokens in `src/index.css` (or equivalent), and the mobile hamburger menu overflow handling.
  - Inspect `nginx/nginx.conf` location blocks `/api/` and `/api/auth/`.
  - Inspect backend query parameter validation in `server/src/routes/listings.ts`.
  - Inspect backend input validation in `server/src/routes/mess.ts` and `server/src/routes/hospital.ts`.
- **Output**: Analysis report highlighting current gaps.

## Phase 2: Implementation of Fixes
- **Goal**: Apply the necessary code and configuration changes to address all gaps.
- **Subagent**: Spawn `teamwork_preview_worker` (Conv ID: Worker_1)
- **Scope**:
  - Update `server/Dockerfile` CMD to run `npx prisma migrate deploy` before launching.
  - Adjust MasterExperience overlays, portal color tokens, and add `overflow: hidden` lock to mobile menu open/close events.
  - Align `/api/auth/` location block in `nginx/nginx.conf` with `/api/` CORS/OPTIONS preflight handler.
  - Implement/fix listings query parameter validation using Zod/Fastify schemas (descriptive 400 Bad Request on invalid status/module/cursor).
  - Implement/fix admin Zod validation for mess and hospital POST/PUT routes (return 400 on empty body).
- **Verification**: Worker should run local builds/tests to verify their code.

## Phase 3: Review & Challenger Verification
- **Goal**: Verify correctness and check for regressions.
- **Subagent**: Spawn `teamwork_preview_reviewer` (Conv ID: Reviewer_1) and `teamwork_preview_challenger` (Conv ID: Challenger_1)
- **Scope**:
  - Perform code review of implementation changes.
  - Run the test suite (`cd server && npm test` and `npm run build`).
  - Run Playwright E2E tests (`npx playwright test`).

## Phase 4: Forensic Audit
- **Goal**: Perform forensic checks to ensure authentic implementation (no hardcoded test results or dummy/facade implementations).
- **Subagent**: Spawn `teamwork_preview_auditor` (Conv ID: Auditor_1)
- **Verdict Requirement**: CLEAN.

## Phase 5: Handoff & Synthesis
- **Goal**: Consolidate findings, update project metadata, and report success to the main agent.
