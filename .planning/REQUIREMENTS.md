# Unified-Experience v1 Production Readiness Requirements

## Scope
This requirement set is derived from:
- Audit digest: `C:/Users/SANDIP/Desktop/Memory/unified_experience_audit_digest.md`
- Current repo production docs (`PRODUCTION_READINESS.md`, `docker-compose.prod.yml`, `nginx.conf`)

v1 target: safe and stable production launch for campus usage.

## Requirement Categories

### QA and Access Baseline
- QA-01: Login form is testable and accessible (`id`, `name`, labels, and stable selectors) so automated and manual auth flows can execute reliably.
- QA-02: Authentication-dependent automated tests run end-to-end (no auth-layer blockers) for admin and student core paths.

### Routing and API Correctness
- API-01: Protected frontend routes under `/admin/*` consistently enforce auth gating and redirect unauthenticated users to `/login`.
- API-02: Backend role checks consistently return `401` (unauthenticated) and `403` (insufficient role) with no role bypass paths.
- API-03: Wrong-method requests on existing API paths return `405 Method Not Allowed` with correct `Allow` header.
- API-04: Production API error responses avoid leaking framework/route internals.

### Security Hardening
- SEC-01: JWT/session implementation is verified and hardened (algorithm allowlist, expiry enforcement, secure storage in httpOnly cookie, logout invalidation behavior defined).
- SEC-02: Input validation/sanitization is enforced on user-controlled fields to prevent stored/reflected XSS.
- SEC-03: Security headers are present in production responses (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and server signature leakage is minimized.
- SEC-04: Login endpoint is brute-force resistant via rate limiting and lockout policy.

### UX and Visual Consistency
- UX-01: Not-found and error routes follow the same design system (no white-theme regression in dark UI).
- UX-02: Landing/login critical layouts are mobile-safe (no horizontal overflow at 375px viewport).
- UX-03: Navigation behavior is standardized by route context (minimal vs full nav rules are consistent and documented).

### Performance and Scalability
- PERF-01: Initial bundle delivery is optimized via route-level splitting and controlled chunk strategy.
- PERF-02: Database connection handling is hardened for spike traffic (pooling strategy validated; no connection-exhaustion failures under target load).
- PERF-03: Core web vitals and synthetic performance scores meet launch thresholds on key routes (`/`, `/login`, authenticated dashboard).

### Operations and Release Governance
- OPS-01: Production deployment config is hardened and reproducible (health checks, secrets, rollback path, persistent data strategy, TLS path).
- OPS-02: Observability and alerting exist for auth failures, error rate spikes, and service health degradation.
- REL-01: Go/No-Go gate is enforced with measurable release criteria and evidence artifacts.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| QA-01 | Phase 1 | Pending |
| QA-02 | Phase 1 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| API-04 | Phase 2 | Pending |
| SEC-01 | Phase 2 | Pending |
| SEC-02 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| SEC-04 | Phase 2 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 3 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| OPS-01 | Phase 5 | Pending |
| OPS-02 | Phase 5 | Pending |
| REL-01 | Phase 5 | Pending |
