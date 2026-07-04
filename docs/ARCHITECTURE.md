# ARCHITECTURE BLUEPRINT — BErozgar Production Backend

> **Status:** LOCKED — No implementation begins until this document is reviewed.  
> **Date:** 2026-02-16  
> **Scope:** Full production backend replacing the in-process mock API layer.  
> **Constraint:** The React frontend (`src/`) continues to work unchanged.  
> Only the base URL flips from in-process interceptor to real HTTP endpoints.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Target Stack](#2-target-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Schema (Prisma)](#4-database-schema-prisma)
5. [Authentication Flow](#5-authentication-flow)
6. [API Route Contract](#6-api-route-contract)
7. [Middleware Pipeline](#7-middleware-pipeline)
8. [Domain Engine Mapping](#8-domain-engine-mapping)
9. [Infrastructure Topology](#9-infrastructure-topology)
10. [Security Posture](#10-security-posture)
11. [Observability](#11-observability)
12. [Migration Plan (Mock → Real)](#12-migration-plan-mock--real)
13. [Deployment Pipeline](#13-deployment-pipeline)
14. [Open Decisions](#14-open-decisions)

---

## 1. System Overview

```
┌───────────────────────────────────────────────────────┐
│                      CLIENT                           │
│  React 18 + Vite + TanStack Query + Zod              │
│  (unchanged — api-client.ts points to real base URL)  │
└───────────────────┬───────────────────────────────────┘
                    │ HTTPS
                    ▼
┌───────────────────────────────────────────────────────┐
│                   NGINX                               │
│  SSL termination (Let's Encrypt)                      │
│  Rate limiting (leaky bucket, L7)                     │
│  Static file serving (dist/)                          │
│  Reverse proxy → :3001                                │
└───────────────────┬───────────────────────────────────┘
                    │ HTTP (internal)
                    ▼
┌───────────────────────────────────────────────────────┐
│              FASTIFY APPLICATION                      │
│  Node.js 20 LTS + TypeScript                          │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐            │
│  │  Auth    │ │ Listings │ │  Requests  │            │
│  │  Plugin  │ │  Plugin  │ │   Plugin   │            │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘            │
│       │             │             │                    │
│  ┌────▼─────────────▼─────────────▼──────┐            │
│  │           SERVICE LAYER               │            │
│  │  Trust Engine  │  FSM Engine          │            │
│  │  Restriction   │  Fraud Heuristics    │            │
│  │  Dispute       │  Audit Logger        │            │
│  └────────────────┬──────────────────────┘            │
│                   │                                   │
│  ┌────────────────▼──────────────────────┐            │
│  │          PRISMA ORM                   │            │
│  │  Type-safe queries                    │            │
│  │  Transactions (serializable)          │            │
│  │  Migrations                           │            │
│  └────────────────┬──────────────────────┘            │
└───────────────────┤───────────────────────────────────┘
                    │ TCP :5432
                    ▼
┌───────────────────────────────────────────────────────┐
│              POSTGRESQL 15+                           │
│  Row-level locking (SELECT ... FOR UPDATE)            │
│  Advisory locks (exchange FSM transitions)            │
│  JSONB columns (audit metadata, trust history)        │
│  Partial indexes (status-based queries)               │
└───────────────────────────────────────────────────────┘
```

---

## 2. Target Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Runtime** | Node.js 20 LTS | Stable, long-term support |
| **Framework** | Fastify 5 | 2-3x faster than Express, native TypeScript, schema-based validation |
| **Language** | TypeScript 5.x (strict) | Same language as frontend, shared Zod schemas |
| **Validation** | Zod | Already used in frontend — single source of truth |
| **ORM** | Prisma 6 | Type-safe queries, migration system, PostgreSQL native |
| **Database** | PostgreSQL 15+ | ACID transactions, advisory locks, JSONB, battle-tested |
| **Auth** | Google OAuth 2.0 (server-verified) + Email/Password | Google primary, email fallback |
| **Tokens** | JWT access (15 min) + httpOnly refresh cookie (7 days) | Refresh rotation, no localStorage for refresh |
| **Password hashing** | argon2 (via `argon2` npm) | Memory-hard, recommended over bcrypt |
| **Logging** | pino | Structured JSON, native Fastify integration |
| **Monitoring** | Sentry | Error tracking, performance monitoring |
| **Containerization** | Docker + Docker Compose | Reproducible environments |
| **Reverse Proxy** | Nginx | SSL, rate limiting, static serving |
| **CI/CD** | GitHub Actions | Build → Test → Deploy pipeline |
| **Hosting (staging)** | Railway / Render | Quick deploys, managed PostgreSQL |
| **Hosting (production)** | VPS (Hetzner/DigitalOcean) + Docker | Full control, cost-effective |

---

## 3. Repository Structure

```
unified-experience/
├── ARCHITECTURE.md          ← this file
├── DESIGN_CONTRACT.md       ← existing (frontend-only)
├── docker-compose.yml       ← dev: postgres + api + nginx
├── docker-compose.prod.yml  ← prod overrides
├── nginx/
│   ├── nginx.conf           ← reverse proxy config
│   └── ssl/                 ← certs (gitignored)
│
├── client/                  ← current src/ (renamed)
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── lib/api-client.ts   ← base URL → env var
│   │   └── ...
│   └── ...
│
├── server/                  ← NEW backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── app.ts              ← Fastify bootstrap
│   │   ├── server.ts           ← Entry point
│   │   ├── config/
│   │   │   ├── env.ts          ← Zod-validated env vars
│   │   │   └── constants.ts    ← Immutable config
│   │   ├── plugins/
│   │   │   ├── auth.ts         ← JWT + cookie plugin
│   │   │   ├── cors.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── csrf.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── listing.routes.ts
│   │   │   ├── request.routes.ts
│   │   │   ├── dispute.routes.ts
│   │   │   ├── profile.routes.ts
│   │   │   ├── admin.routes.ts
│   │   │   └── health.routes.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── listing.service.ts
│   │   │   ├── request.service.ts
│   │   │   ├── dispute.service.ts
│   │   │   ├── profile.service.ts
│   │   │   ├── admin.service.ts
│   │   │   └── audit.service.ts
│   │   ├── domain/
│   │   │   ├── trustEngine.ts       ← COPY from client
│   │   │   ├── restrictionEngine.ts ← COPY from client
│   │   │   ├── fraudHeuristics.ts   ← COPY from client
│   │   │   └── fsm/                 ← COPY from client
│   │   │       ├── types.ts
│   │   │       ├── ListingMachine.ts
│   │   │       ├── RequestMachine.ts
│   │   │       └── index.ts
│   │   ├── middleware/
│   │   │   ├── authenticate.ts      ← JWT verification hook
│   │   │   ├── authorize.ts         ← Role-based access
│   │   │   ├── validate.ts          ← Zod validation hook
│   │   │   └── idempotency.ts       ← Idempotency key middleware
│   │   ├── lib/
│   │   │   ├── prisma.ts            ← Singleton client
│   │   │   ├── google-oauth.ts      ← Server-side token verification
│   │   │   ├── jwt.ts               ← Sign/verify with RS256 or HS256
│   │   │   ├── password.ts          ← Argon2 hash/verify
│   │   │   └── otp.ts               ← TOTP or random 6-digit + email
│   │   ├── errors/
│   │   │   └── index.ts             ← AppError hierarchy
│   │   └── shared/
│   │       └── validation.ts        ← COPY from client (Zod schemas)
│   └── tests/
│       ├── setup.ts
│       ├── auth.test.ts
│       ├── listings.test.ts
│       ├── requests.test.ts
│       ├── disputes.test.ts
│       └── fsm.test.ts             ← COPY from client
│
└── shared/                  ← FUTURE: npm workspace for shared code
    ├── package.json
    └── src/
        ├── validation.ts    ← Zod schemas (single source of truth)
        ├── types.ts         ← User, Listing, Request, Dispute interfaces
        └── fsm/             ← FSM definitions
```

### Monorepo Strategy

**Phase 1 (now):** Copy shared code (`validation.ts`, `domain/`, `fsm/`) into `server/src/`.  
**Phase 2 (after stable):** Extract into `shared/` npm workspace with `"workspaces"` in root `package.json`.  
**Rationale:** Don't introduce workspace complexity before the backend works end-to-end.

---

## 4. Database Schema (Prisma)

```prisma
// server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════
// Users
// ═══════════════════════════════════════════════════

enum UserRole {
  STUDENT
  ADMIN
}

enum AdminPrivilegeLevel {
  SUPER
  REVIEWER
  OBSERVER
}

enum AuthProvider {
  EMAIL
  GOOGLE
}

model User {
  id                String               @id @default(cuid())
  email             String               @unique
  fullName          String
  password          String?              // null for Google-only users
  role              UserRole             @default(STUDENT)
  privilegeLevel    AdminPrivilegeLevel?
  provider          AuthProvider
  verified          Boolean              @default(false)
  avatarUrl         String?

  // Behavioral tracking (server-computed, not client-provided)
  completedExchanges Int                 @default(0)
  cancelledRequests  Int                 @default(0)
  adminFlags         Int                 @default(0)

  // Admin override
  isRestricted       Boolean             @default(false)
  restrictionReason  String?

  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  // Relations
  listings          Listing[]
  buyerRequests     Request[]            @relation("BuyerRequests")
  sellerRequests    Request[]            @relation("SellerRequests")
  filedDisputes     Dispute[]            @relation("FiledDisputes")
  againstDisputes   Dispute[]            @relation("AgainstDisputes")
  auditLogs         AuditLog[]           @relation("AuditActor")
  refreshTokens     RefreshToken[]
  otps              Otp[]

  @@index([email])
  @@index([role])
  @@map("users")
}

// ═══════════════════════════════════════════════════
// Auth — Refresh Tokens
// ═══════════════════════════════════════════════════

model RefreshToken {
  id            String   @id @default(cuid())
  token         String   @unique
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt     DateTime
  revokedAt     DateTime?
  replacedByToken String?  // For refresh rotation: points to new token
  userAgent     String?
  ipAddress     String?
  createdAt     DateTime @default(now())

  @@index([token])
  @@index([userId])
  @@map("refresh_tokens")
}

// ═══════════════════════════════════════════════════
// Auth — OTP Verification
// ═══════════════════════════════════════════════════

model Otp {
  id        String   @id @default(cuid())
  email     String
  code      String
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([email, code])
  @@map("otps")
}

// ═══════════════════════════════════════════════════
// Listings
// ═══════════════════════════════════════════════════

enum ListingModule {
  RESALE
  ACCOMMODATION
  ACADEMICS
  MESS
  HOSPITAL
}

// ListingStatus maps 1:1 to the FSM states defined in ListingMachine.ts
enum ListingStatus {
  DRAFT
  PENDING_REVIEW
  APPROVED
  REJECTED
  INTEREST_RECEIVED
  IN_TRANSACTION
  COMPLETED
  EXPIRED
  FLAGGED
  ARCHIVED
  REMOVED
}

model Listing {
  id          String        @id @default(cuid())
  title       String
  price       String        @default("0")
  category    String
  module      ListingModule
  institution String        @default("")
  description String?
  status      ListingStatus @default(DRAFT)

  createdById String
  createdBy   User          @relation(fields: [createdById], references: [id])

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Relations
  requests    Request[]
  disputes    Dispute[]

  // Performance indexes
  @@index([module, status])
  @@index([createdById])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("listings")
}

// ═══════════════════════════════════════════════════
// Requests (Exchange Lifecycle)
// ═══════════════════════════════════════════════════

// RequestStatus maps 1:1 to the FSM states defined in RequestMachine.ts
enum RequestStatus {
  IDLE
  SENT
  ACCEPTED
  DECLINED
  MEETING_SCHEDULED
  COMPLETED
  EXPIRED
  CANCELLED
  WITHDRAWN
  DISPUTED
  RESOLVED
}

model Request {
  id          String        @id @default(cuid())
  listingId   String
  listing     Listing       @relation(fields: [listingId], references: [id])
  buyerId     String
  buyer       User          @relation("BuyerRequests", fields: [buyerId], references: [id])
  sellerId    String
  seller      User          @relation("SellerRequests", fields: [sellerId], references: [id])
  status      RequestStatus @default(IDLE)
  message     String?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Optimistic locking — prevents stale writes
  version     Int           @default(1)

  @@unique([listingId, buyerId])  // One request per buyer per listing
  @@index([listingId])
  @@index([buyerId])
  @@index([sellerId])
  @@index([status])
  @@map("requests")
}

// ═══════════════════════════════════════════════════
// Disputes
// ═══════════════════════════════════════════════════

enum DisputeType {
  SCAM
  MISREPRESENTATION
  NO_SHOW
  HARASSMENT
}

enum DisputeStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  REJECTED
  ESCALATED
}

model Dispute {
  id          String        @id @default(cuid())
  type        DisputeType
  status      DisputeStatus @default(OPEN)
  description String

  filedById   String
  filedBy     User          @relation("FiledDisputes", fields: [filedById], references: [id])

  againstId   String
  against     User          @relation("AgainstDisputes", fields: [againstId], references: [id])

  listingId   String?
  listing     Listing?      @relation(fields: [listingId], references: [id])

  resolution  String?
  resolvedAt  DateTime?

  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([filedById])
  @@index([againstId])
  @@index([status])
  @@map("disputes")
}

// ═══════════════════════════════════════════════════
// Audit Log
// ═══════════════════════════════════════════════════

model AuditLog {
  id          String   @id @default(cuid())
  actorId     String
  actor       User     @relation("AuditActor", fields: [actorId], references: [id])
  actorRole   String
  action      String   // e.g. LISTING_APPROVED, REQUEST_ACCEPTED, STALE_RECOVERY
  targetType  String   // listing | request | dispute | user | system
  targetId    String
  details     String?
  metadata    Json?    // Flexible JSONB for extra context
  ipAddress   String?

  createdAt   DateTime @default(now())

  @@index([actorId])
  @@index([action])
  @@index([targetType, targetId])
  @@index([createdAt(sort: Desc)])
  @@map("audit_logs")
}

// ═══════════════════════════════════════════════════
// Idempotency Keys
// ═══════════════════════════════════════════════════

model IdempotencyKey {
  id            String   @id @default(cuid())
  key           String   @unique
  userId        String
  responseStatus Int
  responseBody  Json
  expiresAt     DateTime
  createdAt     DateTime @default(now())

  @@index([key, userId])
  @@index([expiresAt])
  @@map("idempotency_keys")
}

// ═══════════════════════════════════════════════════
// Rate Limit (persistent, per-user)
// ═══════════════════════════════════════════════════

model RateLimitEntry {
  id        String   @id @default(cuid())
  key       String   // "userId:endpoint" or "ip:endpoint"
  count     Int      @default(1)
  windowStart DateTime
  expiresAt DateTime

  @@unique([key])
  @@index([expiresAt])
  @@map("rate_limits")
}
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **cuid()** for all IDs | URL-safe, sortable, no collision at scale |
| **Enum for status fields** | DB-enforced constraint, no invalid states |
| **`version` on Request** | Optimistic locking — prevents two users mutating the same request simultaneously |
| **`@@unique([listingId, buyerId])`** | One request per buyer per listing — DB-enforced, not just application logic |
| **`RefreshToken` table** | Server-side refresh rotation + revocation (not just JWT expiry) |
| **`RateLimitEntry` table** | Persistent rate limiting survives restarts (unlike in-memory) |
| **JSONB `metadata` on AuditLog** | Flexible audit context without schema migrations |
| **Separate `Otp` table** | Server-generated OTPs with expiry, not client-guessable |

### Indexes Justification

| Index | Query Pattern |
|-------|---------------|
| `listings(module, status)` | Filter listings by module page + visible status |
| `listings(createdAt DESC)` | "Newest first" default sort |
| `requests(listingId)` | "All requests for this listing" |
| `requests(buyerId)` / `requests(sellerId)` | "My sent/received requests" |
| `audit_logs(createdAt DESC)` | Admin audit log pagination |
| `rate_limits(expiresAt)` | Periodic cleanup of expired entries |

---

## 5. Authentication Flow

### 5.1 Google OAuth (Primary — Server-Side Verification)

```
Client                          Server                       Google
  │                                │                            │
  │─── POST /auth/google ─────────▶│                            │
  │    { credential: "..." }       │                            │
  │                                │── verify token ───────────▶│
  │                                │◀── { email, name, sub } ──│
  │                                │                            │
  │                                │── check domain restriction │
  │                                │── find or create User      │
  │                                │── assign role (registry)   │
  │                                │── generate JWT access      │
  │                                │── generate refresh token   │
  │                                │── store refresh in DB      │
  │                                │── set httpOnly cookie      │
  │                                │                            │
  │◀── 200 { user, accessToken } ──│                            │
  │    + Set-Cookie: refresh=...   │                            │
```

**Server-side token verification** via `google-auth-library`:
```typescript
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ticket = await client.verifyIdToken({
  idToken: credential,
  audience: process.env.GOOGLE_CLIENT_ID,
});
const payload = ticket.getPayload();
// payload.email, payload.name, payload.sub (Google user ID)
```

### 5.2 Email/Password Flow

```
Client                          Server
  │                                │
  │─── POST /auth/signup ─────────▶│
  │    { fullName, email, pwd }    │
  │                                │── validate domain
  │                                │── check email not taken
  │                                │── hash password (argon2)
  │                                │── create User (verified=false)
  │                                │── generate OTP → store in DB
  │                                │── send OTP via email (future)
  │                                │── (dev: return OTP in response)
  │◀── 200 { message, otp? } ─────│
  │                                │
  │─── POST /auth/verify-otp ─────▶│
  │    { email, otp }             │
  │                                │── validate OTP (DB lookup)
  │                                │── mark User verified=true
  │                                │── generate tokens
  │◀── 200 { user, accessToken } ──│
  │    + Set-Cookie: refresh=...   │
```

### 5.3 Token Lifecycle

```
┌──────────────────────────────────────────────────────┐
│ Access Token (JWT, 15 min)                            │
│ • Stored: client memory (React state / api-client)    │
│ • Contains: sub, email, role, privilegeLevel, exp     │
│ • Signature: HS256 (env JWT_SECRET)                   │
│ • NOT in localStorage. NOT in cookies.                │
│ • Sent: Authorization: Bearer <token>                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Refresh Token (opaque, 7 days)                        │
│ • Stored: httpOnly, Secure, SameSite=Strict cookie    │
│ • DB record: token hash, userId, expiresAt, revokedAt │
│ • Rotation: each refresh issues new token, revokes old│
│ • Revocation: logout deletes from DB + clears cookie  │
└──────────────────────────────────────────────────────┘
```

**Refresh Rotation Logic:**
```
POST /auth/refresh  (cookie: refreshToken=old)
  1. Look up old token in DB
  2. If revoked → BREACH DETECTED → revoke ALL user tokens → 401
  3. If expired → 401
  4. Mark old token as revoked (set revokedAt, replacedByToken)
  5. Generate new refresh token → store in DB
  6. Generate new access token
  7. Set-Cookie: refreshToken=new (httpOnly)
  8. Return { accessToken }
```

### 5.4 Role Assignment

Server-side whitelist. Exactly like current mock:

```typescript
const ADMIN_REGISTRY: Record<string, AdminPrivilegeLevel> = {
  'admin@mctrgit.ac.in': 'SUPER',
  'admin@berozgar.in':   'SUPER',
  'reviewer@mctrgit.ac.in': 'REVIEWER',
  'faculty@mctrgit.ac.in':  'OBSERVER',
};

function assignRole(email: string): { role: UserRole; privilegeLevel?: AdminPrivilegeLevel } {
  const entry = ADMIN_REGISTRY[email.toLowerCase()];
  if (entry) return { role: 'ADMIN', privilegeLevel: entry };
  return { role: 'STUDENT' };
}
```

### 5.5 Domain Restriction

Sourced from env `ALLOWED_EMAIL_DOMAINS`:

```typescript
// env: ALLOWED_EMAIL_DOMAINS=mctrgit.ac.in,berozgar.in
const domains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',').map(d => d.trim().toLowerCase()) || [];

function isDomainAllowed(email: string): boolean {
  if (domains.length === 0) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return domains.includes(domain);
}
```

---

## 6. API Route Contract

### 6.1 Complete Route Map

Every route the frontend calls. **This is the contract.** Backend must implement all of these with identical request/response shapes.

#### Auth Routes (`/api/auth/*`)

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| `POST` | `/auth/signup` | No | `{ fullName, email, password }` | `{ message, otp? }` | OTP returned in dev only |
| `POST` | `/auth/verify-otp` | No | `{ email, otp }` | `{ user, accessToken }` + cookie | Marks user verified |
| `POST` | `/auth/login` | No | `{ email, password }` | `{ user, accessToken }` + cookie | Account lockout after 5 failures |
| `POST` | `/auth/google` | No | `{ credential }` | `{ user, accessToken }` + cookie | Server verifies with Google |
| `POST` | `/auth/refresh` | Cookie | (none — reads cookie) | `{ accessToken }` + new cookie | Refresh rotation |
| `POST` | `/auth/logout` | Yes | (none) | `{ message }` | Revoke refresh + clear cookie |
| `GET`  | `/auth/me` | Yes | — | `{ user, trust, restriction }` | Session validation + trust data |
| `GET`  | `/auth/csrf` | Yes | — | `{ csrfToken }` | CSRF token for state-changing ops |

#### Listing Routes (`/api/listings/*`)

| Method | Path | Auth | Body/Query | Response | Notes |
|--------|------|------|------------|----------|-------|
| `GET`  | `/listings` | No | `?module=&status=&search=` | `{ data: Listing[] }` | Public, filterable |
| `GET`  | `/listings/:id` | No | — | `{ data: Listing }` | Single listing |
| `POST` | `/listings` | Yes | `{ title, price, category, module, description? }` | `{ data: Listing }` | Creates in DRAFT → PENDING_REVIEW |
| `PATCH`| `/listings/:id/status` | Yes (admin) | `{ status }` | `{ data: Listing }` | Admin approves/rejects |

#### Request Routes (`/api/requests/*`)

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| `GET`  | `/requests` | Yes | `?listingId=&role=` | `{ data: Request[] }` | User's requests (buyer or seller) |
| `GET`  | `/requests/:id` | Yes | — | `{ data: Request }` | Single request with listing details |
| `POST` | `/requests` | Yes | `{ listingId, message? }` | `{ data: Request }` | Creates request, runs fraud check |
| `PATCH`| `/requests/:id/event` | Yes | `{ event, idempotencyKey? }` | `{ data: Request }` | FSM transition with locking |

#### Dispute Routes (`/api/disputes/*`)

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| `GET`  | `/disputes` | Yes | — | `{ data: Dispute[] }` | User's disputes (admin sees all) |
| `POST` | `/disputes` | Yes | `{ type, against, listingId?, description }` | `{ data: Dispute }` | FK checks, no self-disputes |
| `PATCH`| `/disputes/:id/status` | Yes (admin) | `{ status }` | `{ data: Dispute }` | Admin resolves/escalates |

#### Profile Routes (`/api/profile/*`)

| Method | Path | Auth | Body | Response | Notes |
|--------|------|------|------|----------|-------|
| `GET`  | `/profile` | Yes | — | `{ data: { identity, role, data, trust? } }` | Different shape for admin vs student |

#### Admin Routes (`/api/admin/*`)

| Method | Path | Auth | Role | Response | Notes |
|--------|------|------|------|----------|-------|
| `GET`  | `/admin/pending` | Yes | Admin | `{ data: Listing[] }` | Pending review queue |
| `GET`  | `/admin/stats` | Yes | Admin | `{ data: { totalListings, ... } }` | Dashboard analytics |
| `GET`  | `/admin/users/:userId` | Yes | Admin | `{ data: { user, behavior, trust } }` | User drilldown |
| `GET`  | `/admin/audit` | Yes | Admin | `{ data: AuditLog[], total }` | Paginated audit log |
| `GET`  | `/admin/fraud` | Yes | Admin | `{ data: { flaggedUsers, recentAlerts } }` | Fraud dashboard |
| `GET`  | `/admin/integrity` | Yes | Admin (SUPER) | `{ healthy, violations? }` | FK integrity check |
| `POST` | `/admin/recovery` | Yes | Admin (SUPER) | `{ recovered }` | Manual stale recovery |

#### System Routes

| Method | Path | Auth | Response | Notes |
|--------|------|------|----------|-------|
| `GET`  | `/health` | No | `{ status, version, uptime, stores }` | Load balancer health check |
| `POST` | `/analytics/events` | No | `204 No Content` | Log sink (structured logger) |

### 6.2 Error Response Contract

All errors follow this shape (what the frontend already expects):

```typescript
{
  message: string;        // Human-readable
  code?: string;          // Machine-readable (e.g. "DOMAIN_RESTRICTED")
  errors?: Array<{        // Validation errors (Zod)
    path: string;
    message: string;
  }>;
}
```

HTTP status codes used:
- `400` — Validation error
- `401` — Not authenticated
- `403` — Forbidden (wrong role, domain restricted, idempotency replay)
- `404` — Resource not found
- `409` — Conflict (duplicate listing, invalid FSM transition)
- `422` — Unprocessable (business rule violation — restriction, fraud)
- `429` — Rate limited
- `500` — Internal server error

---

## 7. Middleware Pipeline

```
Request
  │
  ▼
┌─────────────────────┐
│ Request ID (cuid)   │  ← Correlation ID for logging
├─────────────────────┤
│ pino Request Logger │  ← Structured JSON log per request
├─────────────────────┤
│ CORS                │  ← Origin whitelist from env
├─────────────────────┤
│ Helmet              │  ← Security headers
├─────────────────────┤
│ Rate Limiter        │  ← Per-IP + per-user, DB-backed
├─────────────────────┤
│ Cookie Parser       │  ← Parse refresh token cookie
├─────────────────────┤
│ Body Parser (JSON)  │  ← 10KB limit
├─────────────────────┤
│ CSRF Validation     │  ← State-changing routes only
├─────────────────────┤
│ Auth (onRequest)    │  ← JWT verification → req.user
├─────────────────────┤
│ Zod Validation      │  ← Schema validation (preValidation hook)
├─────────────────────┤
│ Idempotency Check   │  ← For POST/PATCH with idempotency key
├─────────────────────┤
│ Route Handler       │  ← Business logic
├─────────────────────┤
│ Error Handler       │  ← Centralized → consistent error shape
├─────────────────────┤
│ Response Time       │  ← X-Response-Time header
│
  ▼
Response
```

### Rate Limiting Strategy

| Endpoint Pattern | Limit | Window | Backing |
|-----------------|-------|--------|---------|
| `POST /auth/login` | 5 | 15 min | DB (survives restart) |
| `POST /auth/signup` | 3 | 15 min | DB |
| `POST /auth/google` | 10 | 15 min | DB |
| `POST /listings` | 10 | 60 min | DB |
| `PATCH /requests/:id/event` | 20 | 60 min | DB |
| `POST /disputes` | 5 | 60 min | DB |
| `GET /admin/audit` | 30 | 60 min | DB |
| `GET /admin/fraud` | 20 | 60 min | DB |
| `POST /admin/recovery` | 5 | 5 min | DB |
| Everything else | 60 | 60 min | In-memory (fast path) |

---

## 8. Domain Engine Mapping

These domain engines are **pure TypeScript functions** with zero dependencies on Node.js or browser APIs. They copy directly from `client/src/domain/` and `client/src/lib/fsm/` to `server/src/domain/`.

| Engine | Source File | Server Usage |
|--------|-----------|-------------|
| **Trust Engine** | `trustEngine.ts` | Called on `/auth/me`, `/profile`, admin user drilldown |
| **Restriction Engine** | `restrictionEngine.ts` | Called before every write operation (listing create, request send, dispute file) |
| **Fraud Heuristics** | `fraudHeuristics.ts` | Called on listing creation, request creation |
| **Listing FSM** | `fsm/ListingMachine.ts` | Validates listing status transitions. `SELECT ... FOR UPDATE` before transition |
| **Request FSM** | `fsm/RequestMachine.ts` | Validates request lifecycle transitions. Advisory lock per request ID |
| **Dispute Engine** | `disputeEngine.ts` | Dispute state management |

### Transaction Isolation for FSM Transitions

The most critical operation is `PATCH /requests/:id/event`. Two users may attempt conflicting transitions simultaneously (seller accepts while buyer cancels).

```typescript
// request.service.ts — atomic FSM transition
async function processRequestEvent(requestId: string, event: RequestEvent, actorId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the request row
    const request = await tx.$queryRaw`
      SELECT * FROM requests WHERE id = ${requestId} FOR UPDATE
    `;
    if (!request) throw new NotFoundError('Request not found');

    // 2. Verify actor is authorized for this event
    verifyEventAuthorization(request, event, actorId);

    // 3. Validate FSM transition
    const machine = createRequestMachine({ state: request.status, history: [] });
    if (!machine.can(event)) {
      throw new ConflictError(`Cannot ${event} from state ${request.status}`);
    }

    // 4. Execute transition
    const next = machine.send(event);

    // 5. Optimistic lock check
    const updated = await tx.request.update({
      where: { id: requestId, version: request.version },
      data: {
        status: next.state,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    if (!updated) throw new ConflictError('Request was modified by another user');

    // 6. Side effects (listing state, user behavior counters)
    await handleRequestSideEffects(tx, request, next.state, event);

    // 7. Audit log
    await tx.auditLog.create({ ... });

    return updated;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
```

---

## 9. Infrastructure Topology

### 9.1 Development (Local)

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: berozgar
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: berozgar_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U berozgar"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: ./server
      dockerfile: Dockerfile
      target: development
    environment:
      DATABASE_URL: postgresql://berozgar:devpassword@postgres:5432/berozgar_dev
      NODE_ENV: development
      JWT_SECRET: dev-secret-change-in-production
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      ALLOWED_EMAIL_DOMAINS: ""
      PORT: 3001
    ports:
      - "3001:3001"
    volumes:
      - ./server/src:/app/src  # Hot reload
    depends_on:
      postgres:
        condition: service_healthy
    command: npm run dev

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
      target: development
    environment:
      VITE_API_BASE_URL: http://localhost:3001/api
    ports:
      - "5173:5173"
    volumes:
      - ./client/src:/app/src

volumes:
  pgdata:
```

### 9.2 Production (VPS)

```
┌─────────────────────────────────────────────────┐
│                VPS (4GB RAM)                     │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │         NGINX (host, not docker)      │        │
│  │  • SSL (Let's Encrypt / certbot)      │        │
│  │  • Rate limit (limit_req_zone)        │        │
│  │  • Serve static dist/ from /var/www   │        │
│  │  • proxy_pass /api → :3001            │        │
│  └────────────┬─────────────────────────┘        │
│               │                                   │
│  ┌────────────▼─────────────────────────┐        │
│  │     Docker Compose (prod)             │        │
│  │                                       │        │
│  │  ┌──────────┐  ┌──────────────────┐  │        │
│  │  │ Fastify  │  │  PostgreSQL 15   │  │        │
│  │  │ :3001    │──│  :5432           │  │        │
│  │  │ 2 inst.  │  │  1GB shared_buf  │  │        │
│  │  └──────────┘  └──────────────────┘  │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  Sentry SDK ────────────────▶ sentry.io          │
│  pino logs ─────────────────▶ stdout → journald  │
└──────────────────────────────────────────────────┘
```

### 9.3 Server Dockerfile

```dockerfile
# server/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS development
RUN npm ci  # include devDependencies
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

---

## 10. Security Posture

### 10.1 Authentication Security

| Measure | Implementation |
|---------|---------------|
| **Password hashing** | argon2id (memory=64MB, iterations=3, parallelism=1) |
| **Refresh token storage** | httpOnly + Secure + SameSite=Strict cookie |
| **Refresh rotation** | Each refresh invalidates old token, breach detection |
| **Account lockout** | 5 failed logins → 15 min lockout (DB-backed) |
| **JWT secret** | env var, minimum 32 bytes, HS256 |
| **Google token verification** | Server-side via `google-auth-library` |
| **OTP** | Server-generated, 6 digits, 10 min expiry, single-use |

### 10.2 Request Security

| Measure | Implementation |
|---------|---------------|
| **CSRF** | Double-submit cookie pattern or Fastify CSRF plugin |
| **Rate limiting** | Per-IP + per-user, DB-backed, sliding window |
| **Input validation** | Zod on every route (preValidation hook) |
| **SQL injection** | Prisma parameterized queries (never raw SQL without params) |
| **XSS** | HTML sanitization on all string inputs (DOMPurify server-side or regex) |
| **CORS** | Strict origin whitelist from env |
| **Content-Type** | Reject non-JSON bodies on API routes |
| **Body size** | 10KB limit |

### 10.3 Infrastructure Security

| Measure | Implementation |
|---------|---------------|
| **SSL/TLS** | Let's Encrypt via certbot, auto-renewal |
| **Helmet** | Security headers (CSP, HSTS, X-Frame-Options) |
| **Docker secrets** | `.env` never in image, mounted at runtime |
| **DB access** | Postgres only accessible from Docker internal network |
| **SSH** | Key-only, no root login |
| **Dependency audit** | `npm audit` in CI, Snyk or similar |

---

## 11. Observability

### 11.1 Structured Logging (pino)

```typescript
// Fastify natively integrates pino
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    // Production: JSON to stdout → journald → optional log shipper
    // Development: pino-pretty for readability
    ...(process.env.NODE_ENV !== 'production' && {
      transport: { target: 'pino-pretty' },
    }),
  },
});
```

Every request automatically logged:
```json
{
  "level": 30,
  "time": 1708099200000,
  "reqId": "abc123",
  "req": { "method": "PATCH", "url": "/api/requests/xyz/event" },
  "res": { "statusCode": 200 },
  "responseTime": 45,
  "userId": "user-001",
  "action": "REQUEST_EVENT",
  "msg": "request completed"
}
```

### 11.2 Sentry Integration

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    Sentry.fastifyIntegration(),
    Sentry.prismaIntegration(),
  ],
});
```

### 11.3 Health Endpoint

Identical to current mock but with real checks:
```typescript
GET /health → {
  status: 'ok',
  version: '1.0.0',
  uptime: process.uptime(),
  database: await prisma.$queryRaw`SELECT 1`, // connection check
  stores: {
    users: await prisma.user.count(),
    listings: await prisma.listing.count(),
    requests: await prisma.request.count(),
    disputes: await prisma.dispute.count(),
  },
  timestamp: new Date().toISOString(),
}
```

### 11.4 Stale Transaction Recovery (Cron)

Instead of `setInterval` in-process, use a proper scheduled job:

```typescript
// Option A: node-cron inside the Fastify process
import cron from 'node-cron';
cron.schedule('*/10 * * * *', async () => {
  const recovered = await staleRecoveryService.run();
  app.log.info({ recovered }, 'Stale transaction recovery completed');
});

// Option B: External cron (recommended for production)
// Separate CLI command: `node dist/jobs/recover-stale.js`
// Called by system cron: */10 * * * * cd /app && node dist/jobs/recover-stale.js
```

---

## 12. Migration Plan (Mock → Real)

### Phase 1: Backend Scaffold (Week 1)
1. Initialize `server/` with Fastify + TypeScript + Prisma
2. Copy domain engines (`fsm/`, `trustEngine`, `restrictionEngine`, `fraudHeuristics`)
3. Copy validation schemas (`validation.ts`)
4. Set up Docker Compose (Postgres + API)
5. Run `prisma migrate dev` — create all tables
6. Implement `/health` endpoint
7. **Checkpoint:** `docker-compose up` → `/health` returns 200

### Phase 2: Auth (Week 2)
1. Implement all 8 auth routes
2. Google OAuth server-side verification
3. httpOnly refresh cookie + rotation
4. Account lockout
5. **Checkpoint:** Frontend login works against real backend

### Phase 3: Core CRUD (Week 3)
1. Listings CRUD with Zod validation
2. Requests lifecycle with FSM + `FOR UPDATE` locking
3. Disputes CRUD
4. Profile endpoint (student + admin shapes)
5. **Checkpoint:** All frontend pages render with real data

### Phase 4: Admin + Integrity (Week 4)
1. Admin routes (pending, stats, users, audit, fraud)
2. Stale recovery job
3. Integrity check endpoint
4. Rate limiting (DB-backed)
5. CSRF
6. **Checkpoint:** Admin dashboard fully functional

### Phase 5: Frontend Switchover (Week 5)
1. Update `api-client.ts` base URL to read from `VITE_API_BASE_URL`
2. Remove mock API interceptor (`installMockApi()` call in `main.tsx`)
3. Test all flows end-to-end
4. **Checkpoint:** Frontend works identically with real backend

### Phase 6: Production Deploy (Week 6)
1. VPS setup (Docker + Nginx + certbot)
2. CI/CD pipeline (GitHub Actions)
3. Sentry + monitoring
4. Seed production data
5. Beta test with real users
6. **Checkpoint:** Production URL live

### Frontend Changes Required

**Minimal.** The frontend was designed to be backend-agnostic:

| File | Change |
|------|--------|
| `api-client.ts` | `baseURL` reads from `VITE_API_BASE_URL` instead of hardcoded `/api` |
| `main.tsx` | Remove `installMockApi()` call (or gate behind env flag) |
| `api-client.ts` | Refresh token handling — don't send `refreshToken` in body; server reads from cookie |
| `AuthContext.tsx` | Remove `sessionManager.setTokens(refreshToken)` — refresh is httpOnly cookie now |

That's it. Everything else (Zod validation, TanStack Query hooks, UI components) stays exactly the same.

---

## 13. Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: berozgar_test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd server && npm ci
      - run: cd server && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/berozgar_test
      - run: cd server && npm test
      - run: cd client && npm ci
      - run: cd client && npm run build
      - run: cd client && npx vitest run

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VPS
        run: |
          ssh ${{ secrets.VPS_HOST }} << 'EOF'
            cd /opt/berozgar
            git pull
            docker compose -f docker-compose.prod.yml build
            docker compose -f docker-compose.prod.yml up -d
            docker compose exec api npx prisma migrate deploy
          EOF
```

---

## 14. Open Decisions

These require your input before implementation begins:

| # | Decision | Options | Impact |
|---|----------|---------|--------|
| 1 | **Hosting provider** | Railway (easy) vs VPS (control) vs Render (middle) | Cost, deployment complexity |
| 2 | **Email provider for OTP** | Resend / SendGrid / Nodemailer + SMTP | Signup flow, cost |
| 3 | **JWT algorithm** | HS256 (simpler) vs RS256 (asymmetric, better for microservices) | Security, complexity |
| 4 | **File uploads (future)** | S3-compatible (Cloudflare R2) vs local disk | Listing images |
| 5 | **Monorepo tool** | npm workspaces (built-in) vs Turborepo (caching) | Build speed at scale |
| 6 | **Search** | PostgreSQL full-text search vs Meilisearch | Listing search quality |
| 7 | **Real-time** | WebSocket (Fastify WS) vs SSE vs polling | Notification center, live updates |
| 8 | **Package manager** | npm (standard) vs pnpm (faster, disk-efficient) | DX, CI speed |

---

## Appendix A: Environment Variables

```bash
# server/.env.example

# ── Core
NODE_ENV=development
PORT=3001

# ── Database
DATABASE_URL=postgresql://berozgar:password@localhost:5432/berozgar_dev

# ── Auth
JWT_SECRET=generate-a-32-byte-random-string-here
JWT_ACCESS_TTL_SECONDS=900        # 15 min
JWT_REFRESH_TTL_SECONDS=604800    # 7 days
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# ── Domain
ALLOWED_EMAIL_DOMAINS=mctrgit.ac.in,berozgar.in   # empty = allow all

# ── Rate Limiting
RATE_LIMIT_ENABLED=true

# ── CORS
ALLOWED_ORIGINS=http://localhost:5173,https://berozgar.in

# ── Monitoring
SENTRY_DSN=
LOG_LEVEL=info    # debug | info | warn | error

# ── Recovery
STALE_RECOVERY_CRON=*/10 * * * *
STALE_TRANSACTION_TTL_HOURS=48
```

## Appendix B: Shared Zod Schemas (Copy Plan)

These files copy verbatim from client to server:

| Source | Destination | Shared? |
|--------|------------|---------|
| `client/src/lib/validation.ts` | `server/src/shared/validation.ts` | Phase 2: `shared/` workspace |
| `client/src/domain/trustEngine.ts` | `server/src/domain/trustEngine.ts` | Phase 2: `shared/` workspace |
| `client/src/domain/restrictionEngine.ts` | `server/src/domain/restrictionEngine.ts` | Phase 2: `shared/` workspace |
| `client/src/domain/fraudHeuristics.ts` | `server/src/domain/fraudHeuristics.ts` | Phase 2: `shared/` workspace |
| `client/src/lib/fsm/*` | `server/src/domain/fsm/*` | Phase 2: `shared/` workspace |
| `client/src/test/domain/*` | `server/tests/domain/*` | Tests copy too |
| `client/src/test/fsm/*` | `server/tests/fsm/*` | Tests copy too |

These are **pure functions** with no browser or Node.js dependencies. They work identically in both environments.

---

**END OF ARCHITECTURE BLUEPRINT**

> Next step: Review this document. When approved, Phase 1 (scaffold) begins.
