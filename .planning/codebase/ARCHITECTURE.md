# Application Architecture

## Pattern & Layers
The project implements a decoupled Client-Server architecture:
1. **Client Layer (React/Vite):** A SPA managed by Vite. Uses Tanstack Query for external state caching and React Context + local state for UI management.
2. **Reverse Proxy (Nginx):** Acts as the API Gateway and static file server. Handles SSL termination and layer 7 rate limiting.
3. **Application Server Layer (Fastify/Node.js):** Acts as the primary backend handling business logic. Organizes logic into services and plugins (Auth, Listings, Requests). Features robust FSM (Finite State Machine) engines for Listings and Requests lifecycles, and a Trust Engine for domain-specific metrics.
4. **Data Access Layer (Prisma):** Handles all database queries safely using Prisma ORM.

## Data Flow
- **Client → Server:** The frontend currently makes API calls via `api-client.ts`. Previously mapped to in-process mock interceptors, now targeted towards the Fastify backend real HTTP endpoints. 
- **Server → Database:** Controllers process the API requests with Zod schema validation, interact with services representing Core Domain logic, which then query PostgreSQL securely over TCP via Prisma.
- **Authentication Flow:**
  - Fastify issues short-lived JWT access tokens (15m, sent via header) and long-lived refresh tokens (7 days, stored in httpOnly, Secure cookies).
  - Refresh rotation is employed for high security.

## Key Abstractions
- **FSM Engine:** Both Listings and Requests utilize strict Finite State Machines to transition between statuses (e.g., `DRAFT` → `PENDING_REVIEW` → `APPROVED`).
- **Domain Engine Mapping:** Features separate engines such as `trustEngine.ts`, `fraudHeuristics.ts`, and `restrictionEngine.ts` to govern admin and user restrictions, behavior tracking, and rule validation.

## Entry Points
- **Frontend Entry:** `src/main.tsx` and `src/App.tsx`.
- **Backend Entry:** `server/src/server.ts` (starts Fastify) and `server/src/app.ts` (bootstraps plugins, routes, etc).
