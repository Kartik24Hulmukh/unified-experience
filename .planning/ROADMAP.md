# Unified-Experience Production Readiness Roadmap

## Context
Roadmap source inputs:
- `C:/Users/SANDIP/Desktop/Memory/unified_experience_audit_digest.md`
- `PRODUCTION_READINESS.md`
- `docker-compose.prod.yml`
- `nginx.conf`

Granularity: Standard (balanced grouping, 5 phases).

## Phases
- [ ] **Phase 1: QA Unblock and Access Control Correctness** - Remove auth test blockers and enforce deterministic route/API access behavior.
- [ ] **Phase 2: Security Hardening and API Hygiene** - Close critical auth/session/XSS/header risks for safe handling of student data.
- [ ] **Phase 3: UX Consistency and Mobile Reliability** - Eliminate cross-route visual regressions and mobile breakage on primary public flows.
- [ ] **Phase 4: Performance and Scale Readiness** - Meet launch SLOs for web vitals and concurrency resilience.
- [ ] **Phase 5: Production Ops and Go-Live Gate** - Lock operational controls, observability, and measurable release sign-off.

## Phase Details

### Phase 1: QA Unblock and Access Control Correctness
**Goal**: Users and QA can reliably authenticate and reach only the routes/APIs permitted by their auth state and role.
**Depends on**: Nothing (first phase)
**Requirements**: QA-01, QA-02, API-01, API-02, API-03
**Deliverables**:
1. Login form accessibility and automation attributes implemented and validated.
2. Authenticated E2E suite for admin/student core paths running without auth-blocked status.
3. Frontend route guard audit completed for all `/admin/*` paths.
4. Backend authz behavior matrix for key endpoints with expected `401/403` outcomes.
5. Wrong-method handling normalized to `405` with `Allow` header on existing routes.
**Success Criteria** (what must be TRUE):
1. QA automation can complete login and reach post-login routes without manual token injection.
2. Unauthenticated users attempting `/admin`, `/admin/dashboard`, and other `/admin/*` routes are redirected to `/login` consistently.
3. Student tokens cannot access admin APIs; attempts return `403` and are logged.
4. Requests to valid paths with wrong HTTP methods return `405` and include the allowed methods.
**Acceptance Criteria**:
1. Playwright auth flow suite passes on two consecutive runs with zero auth-blocked tests.
2. RBAC matrix checks pass for unauthenticated/student/admin personas across defined protected routes.
3. API integrity test report shows no high-severity failures in auth and method handling checks.
**Measurable Done Conditions**:
1. `Auth-blocked test count = 0` in latest E2E report.
2. `Admin route guard pass rate = 100%` for audited `/admin/*` entries.
3. `Wrong-method compliance = 100%` on sampled API endpoints.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Security Hardening and API Hygiene
**Goal**: The platform enforces secure session behavior and input/output protections suitable for handling real student data.
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, API-04
**Deliverables**:
1. JWT/session architecture decision and implementation validated (cookie flags, expiry, algorithm policy, invalidation behavior).
2. Input validation and output sanitization coverage for high-risk user-input surfaces.
3. Security header policy active at edge and application layers, with server signature minimization.
4. Login brute-force throttling and abuse telemetry.
5. Production error-response contract that removes framework and route leakage.
**Success Criteria** (what must be TRUE):
1. User session tokens are not exposed to JavaScript-readable storage in production login flow.
2. Common XSS payload attempts are rejected or neutralized on create/edit flows.
3. Security headers are present on primary HTML and API responses.
4. Repeated failed login attempts trigger deterministic rate limiting.
5. Invalid route/method requests return generic production-safe errors.
**Acceptance Criteria**:
1. Manual security verification matrix completed for token storage, JWT claims/algorithms, RBAC enforcement, and logout invalidation.
2. Header validation (`curl -I` plus external scanner) meets defined policy baseline.
3. Security regression tests pass for auth abuse and XSS payload suites.
**Measurable Done Conditions**:
1. `Critical open security findings = 0` and `High open security findings <= 1` (documented exception only).
2. `100%` of required security headers present on `/` and `/api/*` sampled responses.
3. `429 rate-limit response` observed under configured threshold tests.
**Plans**: TBD

### Phase 3: UX Consistency and Mobile Reliability
**Goal**: Public and auth-entry user journeys are visually consistent, accessible, and reliable on desktop and mobile breakpoints.
**Depends on**: Phase 1
**Requirements**: UX-01, UX-02, UX-03
**Deliverables**:
1. Unified error/404 visual treatment aligned with global layout and theme tokens.
2. Mobile overflow and hero text responsiveness fixes on key public pages.
3. Navigation variant strategy (minimal/full) implemented consistently by route type.
4. Route-level visual regression checklist and snapshots for critical journeys.
**Success Criteria** (what must be TRUE):
1. Users never encounter a white-theme or broken-layout regression when navigating to invalid routes.
2. Users on 375px-width mobile devices can read hero content and interact with CTAs without horizontal scrolling.
3. Navigation structure and behavior are predictable across landing, login, home, and protected contexts.
**Acceptance Criteria**:
1. Visual regression checks pass for documented critical routes in desktop and mobile viewport sets.
2. Accessibility smoke checks pass for login and navigation landmarks.
3. QA sign-off confirms no high-severity UI consistency defects in launch routes.
**Measurable Done Conditions**:
1. `Horizontal overflow incidents = 0` at 375px/390px/768px on audited routes.
2. `Critical visual regression diffs = 0` in baseline comparison set.
3. `Navigation consistency checks = 100%` for route matrix.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Performance and Scale Readiness
**Goal**: The app sustains expected launch traffic with acceptable user-perceived performance and backend stability.
**Depends on**: Phase 2, Phase 3
**Requirements**: PERF-01, PERF-02, PERF-03
**Deliverables**:
1. Route-level code splitting and chunk strategy applied to reduce initial payload.
2. Database concurrency hardening validated (pool sizing/pooler decision and soak-test evidence).
3. Performance budget and optimization fixes for key routes and render path.
4. Load and web-vitals evidence pack for go-live review.
**Success Criteria** (what must be TRUE):
1. First-time visitors see key content faster on `/` and `/login` under representative network conditions.
2. Concurrent login/dashboard traffic does not cause database connection exhaustion.
3. Performance metrics on critical routes meet launch thresholds.
**Acceptance Criteria**:
1. Synthetic load test passes target concurrent users without sustained error-rate spikes.
2. Lighthouse/Web Vitals reports meet agreed thresholds on key routes.
3. No P1 performance regressions remain open in launch scope.
**Measurable Done Conditions**:
1. `LCP <= 2.5s` on `/` and `/login` (target profile), and `TTFB <= 800ms`.
2. `Lighthouse performance >= 80` on key routes for launch baseline.
3. `Database connection exhaustion events = 0` in soak test window.
**Plans**: TBD

### Phase 5: Production Ops and Go-Live Gate
**Goal**: Deployment, monitoring, and release governance are robust enough for controlled production launch and rollback safety.
**Depends on**: Phase 2, Phase 4
**Requirements**: OPS-01, OPS-02, REL-01
**Deliverables**:
1. Production runbook covering deploy, rollback, backup/restore, secret rotation, and incident response.
2. Observability baseline (health checks, auth failure metrics, error-rate alerts, uptime checks).
3. Release gate checklist with objective pass/fail criteria and evidence links.
4. Final go/no-go review package.
**Success Criteria** (what must be TRUE):
1. Team can deploy and rollback safely with documented and tested procedure.
2. Operators receive alerts before user-facing failures become widespread.
3. Release approval is based on measurable checks, not ad hoc judgment.
**Acceptance Criteria**:
1. Staging to production rehearsal succeeds, including rollback drill.
2. Alert routing is tested and confirms signal delivery for simulated incidents.
3. Go-live checklist is fully passed and signed with evidence.
**Measurable Done Conditions**:
1. `Deployment rehearsal success rate = 100%` for deploy + rollback dry run.
2. `P0/P1 blocker count = 0` at release decision point.
3. `All release gates passed = true` with timestamped artifacts.
**Plans**: TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. QA Unblock and Access Control Correctness | 0/3 | Not started | - |
| 2. Security Hardening and API Hygiene | 0/3 | Not started | - |
| 3. UX Consistency and Mobile Reliability | 0/2 | Not started | - |
| 4. Performance and Scale Readiness | 0/3 | Not started | - |
| 5. Production Ops and Go-Live Gate | 0/2 | Not started | - |
