# BErozgar Codebase Investigation and Verification Report (R1–R6)

This report documents the read-only investigation and verification status of requirements R1 through R6 in the `unified-experience` workspace.

---

## Executive Summary

| Req # | Requirement Name | Status | Key Files & Line Numbers | Summary of Findings | Proposed Fix |
|---|---|---|---|---|---|
| **R1** | Database Migration Container Startup Setup | **PASS** | `server/Dockerfile` (L35) | CMD runs `npx prisma migrate deploy` before `node dist/server.cjs` under `USER node`. | *None required.* |
| **R2** | MasterExperience Dark Mode & Portal Tokens | **WARNING** | `src/components/MasterExperience.tsx` (L66), `src/index.css` (L61-63, L154-155) | Overlays are theme-neutral and provide good contrast. However, the card shadow class `hover:shadow-[0_0_30px_rgba(var(--portal-foreground),0.1)]` evaluates to invalid CSS because `--portal-foreground` contains HSL values (`0 0% 100%`). | Change `rgba(var(--portal-foreground),0.1)` to `hsla(var(--portal-foreground),0.1)` or `rgba(255,255,255,0.1)`. |
| **R3** | Mobile Hamburger Menu Scroll Lock | **PASS** | `src/components/ContextNav.tsx` (L161-170) | A `useEffect` hook correctly sets `document.body.style.overflow = 'hidden'` when the menu is open, and restores it on close via its cleanup function. | *None required.* |
| **R4** | Nginx CORS & OPTIONS configuration | **PASS** | `nginx/nginx.conf` (L141-178, L181-214) | Both `/api/` and `/api/auth/` location blocks have identical, correct CORS headers and `OPTIONS` preflight handlers returning 204. | *None required.* |
| **R5** | Routing Query Parameter Validation | **PASS** | `server/src/routes/listings.ts` (L36-60) | GET `/listings` validates `status`, `module`, and `cursor` query parameters and returns 400 Bad Request for invalid values instead of causing a 500. | *None required.* |
| **R6** | Admin Body Input Validation | **PASS** | `server/src/routes/mess.ts` (L26-38, L41-55), `server/src/routes/hospital.ts` (L26-38, L41-55), `server/src/shared/validation.ts` (L212-234) | POST/PUT routes are validated using Zod schemas via `validate` middleware. Empty bodies throw `ValidationError` which maps to HTTP 400. | *None required.* |

---

## Detailed Findings and Proposed Fixes

### R1. Verify Database Migration Container Startup Setup
* **Target File**: `server/Dockerfile`
* **Observations**:
  - The production stage container configuration is as follows:
    ```dockerfile
    25: FROM base AS production
    26: ENV NODE_ENV=production
    27: COPY --from=deps /app/node_modules ./node_modules
    28: RUN apk add --no-cache wget
    29: COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
    30: COPY --from=build /app/dist ./dist
    31: COPY prisma ./prisma
    32: COPY package.json ./
    33: EXPOSE 3001
    34: USER node
    35: CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.cjs"]
    ```
  - The `deps` stage runs `npm ci --ignore-scripts` followed by `npx prisma generate`. Thus, the `prisma` CLI tool and schema files are present inside the production container.
  - The entry point runs database migrations using `npx prisma migrate deploy` before executing `node dist/server.cjs`.
  - The PostgreSQL service health check in `docker-compose.prod.yml` guarantees that database connections are only made once the database container is healthy:
    ```yaml
    91:     depends_on:
    92:       postgres:
    93:         condition: service_healthy
    ```
* **Status**: **PASS**
* **Proposed Fix**: None.

---

### R2. Verify Dark Mode Readability on MasterExperience
* **Target Files**: `src/components/MasterExperience.tsx`, `src/index.css`
* **Observations**:
  - In `src/index.css`, portal color tokens are defined under `:root` and `.dark` block:
    ```css
    61:     /* The Portal - Pure Black */
    62:     --portal: 0 0% 0%;
    63:     --portal-foreground: 0 0% 100%;
    ```
  - These are in HSL space (`H S% L%`).
  - In `src/components/MasterExperience.tsx`, card components in `ModuleNavPanel` render overlays using:
    ```tsx
    85:                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
    ```
    This is a theme-neutral black overlay providing high contrast against white text labels (`text-white`, `text-white/80`).
  - However, in `src/components/MasterExperience.tsx` line 66, the shadow effect uses:
    ```tsx
    hover:shadow-[0_0_30px_rgba(var(--portal-foreground),0.1)]
    ```
    Since `--portal-foreground` contains spaces and percentage signs (`0 0% 100%`), the browser translates the compiled CSS rule to `box-shadow: 0 0 30px rgba(0 0% 100%, 0.1);`. This is syntactically invalid for `rgba()` and fails to render the shadow.
* **Status**: **WARNING** (CSS Bug)
* **Proposed Fix**:
  Change `rgba(var(--portal-foreground),0.1)` to `hsla(var(--portal-foreground),0.1)` or `rgba(255,255,255,0.1)`.
  * **Before**:
    ```tsx
    className={`module-item group relative cursor-pointer overflow-hidden rounded-2xl border border-portal-foreground/10 bg-portal-foreground/[0.02] transform transition-all duration-500 hover:scale-[1.02] hover:bg-portal-foreground/[0.04] hover:shadow-[0_0_30px_rgba(var(--portal-foreground),0.1)] flex flex-col justify-between p-6 sm:p-8 ${
    ```
  * **After**:
    ```tsx
    className={`module-item group relative cursor-pointer overflow-hidden rounded-2xl border border-portal-foreground/10 bg-portal-foreground/[0.02] transform transition-all duration-500 hover:scale-[1.02] hover:bg-portal-foreground/[0.04] hover:shadow-[0_0_30px_hsla(var(--portal-foreground),0.1)] flex flex-col justify-between p-6 sm:p-8 ${
    ```

---

### R3. Verify Mobile Hamburger Menu Body Scroll Lock
* **Target File**: `src/components/ContextNav.tsx`
* **Observations**:
  - The menu opened/closed state is tracked by `isMenuOpen` state (L33).
  - The scrolling lock/restore logic is implemented as:
    ```tsx
    161:   // Lock body scroll while menu is open to prevent double scrollbars
    162:   useEffect(() => {
    163:     if (isMenuOpen) {
    164:       const originalOverflow = document.body.style.overflow;
    165:       document.body.style.overflow = 'hidden';
    166:       return () => {
    167:         document.body.style.overflow = originalOverflow;
    168:       };
    169:     }
    170:   }, [isMenuOpen]);
    ```
  - When `isMenuOpen` is `true`, `document.body.style.overflow` is locked to `'hidden'`.
  - When `isMenuOpen` changes back to `false` (or the component unmounts), the cleanup function runs and restores the original overflow value.
* **Status**: **PASS**
* **Proposed Fix**: None.

---

### R4. Verify Nginx Configurations
* **Target File**: `nginx/nginx.conf`
* **Observations**:
  - The `/api/` block contains correct CORS headers and returns 204 on `OPTIONS` (L141-178).
  - The `/api/auth/` block is verified to contain the identical setup (L181-214):
    ```nginx
    184:             # CORS at edge (only whitelisted origins)
    185:             add_header  Access-Control-Allow-Origin       $cors_origin  always;
    186:             add_header  Access-Control-Allow-Methods      "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    187:             add_header  Access-Control-Allow-Headers      "Authorization, Content-Type, X-Idempotency-Key, X-CSRF-Token" always;
    188:             add_header  Access-Control-Allow-Credentials  "true"        always;
    189:             add_header  Access-Control-Max-Age            "86400"       always;
    190: 
    191:             # Preflight
    192:             if ($request_method = 'OPTIONS') {
    193:                 add_header  Access-Control-Allow-Origin       $cors_origin  always;
    194:                 add_header  Access-Control-Allow-Methods      "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    195:                 add_header  Access-Control-Allow-Headers      "Authorization, Content-Type, X-Idempotency-Key, X-CSRF-Token" always;
    196:                 add_header  Access-Control-Allow-Credentials  "true"        always;
    197:                 add_header  Access-Control-Max-Age            "86400"       always;
    198:                 add_header  Content-Length                     0;
    199:                 add_header  Content-Type                      "text/plain";
    200:                 return 204;
    201:             }
    ```
* **Status**: **PASS**
* **Proposed Fix**: None.

---

### R5. Verify Routing Query Parameter Validation
* **Target File**: `server/src/routes/listings.ts`
* **Observations**:
  - The GET `/listings` route validates parameters (L36-60):
    - `status`: Normalizes to upper case and checks against valid database enum values (`VALID_STATUSES`). Returns 400 Bad Request if invalid.
    - `module`: Normalizes to upper case and checks against valid database enum values (`VALID_MODULES`). Returns 400 Bad Request if invalid.
    - `cursor`: Checks format against a strict UUID v4 regex (`UUID_REGEX`). Returns 400 Bad Request if invalid.
  - This validation prevents invalid values from reaching Prisma service calls (which would otherwise cause a 500 error or database crash).
* **Status**: **PASS**
* **Proposed Fix**: None.

---

### R6. Verify Admin Body Input Validation
* **Target Files**: `server/src/routes/mess.ts`, `server/src/routes/hospital.ts`, `server/src/shared/validation.ts`
* **Observations**:
  - POST and PUT routes for mess (`/admin/mess` and `/admin/mess/:id`) and hospitals (`/admin/hospitals` and `/admin/hospitals/:id`) utilize the `validate` middleware factory:
    - Mess uses `createMessProviderSchema` and `updateMessProviderSchema`.
    - Hospital uses `createHospitalSchema` and `updateHospitalSchema`.
  - The `validate` middleware (in `server/src/middleware/validate.ts`) parses the request body using Zod's `safeParse`.
  - If validation fails (e.g. empty body for POST/PUT), a `ValidationError` is thrown, which Fastify's global error handler translates to a 400 Bad Request response:
    ```typescript
    173:     if (error instanceof AppError) {
    174:       const serialized = serializeError(error);
    175:       return reply.status(serialized.statusCode).send(serialized.body);
    176:     }
    ```
    (Where `ValidationError` has `statusCode: 400`).
* **Status**: **PASS**
* **Proposed Fix**: None.
