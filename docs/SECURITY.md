# BErozgar — Security Architecture & Guidelines

This document consolidates security auditing findings, control mechanisms, and design decisions governing the BErozgar campus platform.

---

## 1. Core Threat Model & Roles

The platform enforces three distinct permission levels:
1. **Public User (Outsider)**: Authenticated but unverified. Limited to read-only browsing of listings. Blocked from listing creation, requests, and dispute management.
2. **Verified Student**: Verified via a valid `@mctrgit.ac.in` email. Full access to write actions: creating resale/accommodation/academics listings, transacting, and triggering the trust exchange system.
3. **Administrator**: Full administrative control: approving/rejecting listings, reviewing fraud/dispute reports, and managing mess/hospital directories.

---

## 2. Security Enhancements Implemented

### 2.1 Write-Protection Middleware (`requireVerifiedStudent`)
To prevent role-spoofing and API attacks, the server executes `requireVerifiedStudent` on all write routes (POST, PUT, PATCH, DELETE) for:
- `/api/listings`
- `/api/requests`
- `/api/disputes`

If a `PUBLIC_USER` attempts to access these endpoints, the server rejects the request with a `403 Forbidden` response.

### 2.2 Secure Session Management & CSRF
- **JWT Authentication**: Utilizes secure `httpOnly`, `secure`, `sameSite: strict` cookies for token storage.
- **CSRF Token Verification**: Protects against cross-site request forgery via token checks on state-changing requests.
- **Active Refresh Controls**: Validates token expiration lifetimes, rejecting outdated sessions.

### 2.3 Analytics Endpoint Spoofing Prevention
The `POST /api/analytics/events` endpoint passively decodes the caller's JWT token. If authenticated, it ignores client-supplied `user.id` or `user.role` payloads, overriding them with the server-validated JWT identity to prevent spoofing.

---

## 3. Production Hardening Requirements

> [!IMPORTANT]
> **Secret Rotation**: Rotate the production `JWT_SECRET`, database passwords, and Resend API keys immediately on the hosting VPS. Never commit environment variables containing actual production secrets.

### 3.1 Hardened Nginx Configurations
The default Docker deployment routes through the configuration at `nginx/nginx.conf`, enforcing:
- Strict Content Security Policy (CSP) omitting `localhost` access patterns.
- HTTP Strict Transport Security (HSTS) configuration.
- Prevention of clickjacking via `X-Frame-Options: DENY`.
- Rate-limiting blocks on high-frequency API endpoints.

---

## 4. Key Reference Documents
For granular historical analysis and protocol traces, consult:
- [AUTH_LIFECYCLE_AUDIT_V2.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/audits/AUTH_LIFECYCLE_AUDIT_V2.md): Session lifecycle validation.
- [EXCHANGE_LIFECYCLE_AUDIT_V3.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/audits/EXCHANGE_LIFECYCLE_AUDIT_V3.md): Trust engine, FSM transition safety, and dispute resolution logic.
- [SECURITY_AUDIT.md](file:///c:/Users/praja/OneDrive/Desktop/Berozgar/unified-experience/docs/audits/SECURITY_AUDIT.md): General network, package, and environment vulnerability sweeps.
