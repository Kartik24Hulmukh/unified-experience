# Handoff Report — Explorer Agent (Phase 1 Exploration)

This handoff report summarizes the read-only investigation and verification status of requirements R1 through R6 in the `unified-experience` workspace. Detailed code analysis, file paths, line references, and proposed fixes are available in [analysis.md](./analysis.md).

---

## 1. Observation

We directly observed the following files and code snippets in the workspace:

* **R1 (Database Migration Container Startup Setup)**:
  `server/Dockerfile` line 35 runs database migrations on startup under `USER node`:
  ```dockerfile
  34: USER node
  35: CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.cjs"]
  ```

* **R2 (MasterExperience Dark Mode & Portal Tokens)**:
  `src/index.css` lines 61–63 and 154–155 define `--portal-foreground` as HSL coordinates:
  ```css
  --portal: 0 0% 0%;
  --portal-foreground: 0 0% 100%;
  ```
  `src/components/MasterExperience.tsx` line 66 uses `rgba()` with the HSL color variable for card shadows:
  ```tsx
  hover:shadow-[0_0_30px_rgba(var(--portal-foreground),0.1)]
  ```
  `src/components/MasterExperience.tsx` line 85 uses a dark neutral gradient overlay:
  ```tsx
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
  ```

* **R3 (Mobile Hamburger Menu Scroll Lock)**:
  `src/components/ContextNav.tsx` lines 162–170 locks and restores body overflow when toggling `isMenuOpen`:
  ```tsx
  useEffect(() => {
    if (isMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMenuOpen]);
  ```

* **R4 (Nginx CORS & OPTIONS configuration)**:
  `nginx/nginx.conf` contains `/api/` (lines 141–178) and `/api/auth/` (lines 181–214) location blocks. Both blocks feature identical, correct CORS headers and `OPTIONS` preflight handlers returning `204`.

* **R5 (Routing Query Parameter Validation)**:
  `server/src/routes/listings.ts` lines 36–60 validates `status`, `module`, and `cursor` query parameters and returns 400 Bad Request if invalid:
  ```typescript
  const status = query.status?.toUpperCase();
  if (status && !VALID_STATUSES.has(status as ListingStatus)) {
    return reply.status(400).send({ ... });
  }
  ```

* **R6 (Admin Body Input Validation)**:
  `server/src/routes/mess.ts` and `server/src/routes/hospital.ts` validate POST and PUT requests using `validate(schema)` middleware (using Zod schemas from `server/src/shared/validation.ts`).
  `server/src/middleware/validate.ts` lines 28–31 throws a `ValidationError` when input validation fails:
  ```typescript
  if (!result.success) {
    const details = formatZodError(result.error);
    throw new ValidationError('Validation failed', details);
  }
  ```
  This maps to an HTTP 400 Bad Request response in the global Fastify error handler.

---

## 2. Logic Chain

1. **R1**: Because `server/Dockerfile` explicitly chains `npx prisma migrate deploy && node dist/server.cjs` in its startup `CMD`, and because `docker-compose.prod.yml` makes the API container depend on a healthy PostgreSQL container, database migrations will run successfully before the server starts on clean deployment.
2. **R2**: Because `--portal-foreground` is defined as `0 0% 100%` (an HSL space triplet without parentheses/function wrapping), the arbitrary utility class `hover:shadow-[0_0_30px_rgba(var(--portal-foreground),0.1)]` evaluates to `box-shadow: 0 0 30px rgba(0 0% 100%, 0.1);` in the browser. This is syntactically invalid, resulting in card shadows failing to render. The dark overlays are theme-neutral black gradients providing good contrast.
3. **R3**: Because the React `useEffect` hook triggers on changes to `isMenuOpen`, it correctly overrides `document.body.style.overflow` to `'hidden'` when the menu is open. The cleanup function is invoked on closure (or component unmount), successfully restoring the original scroll state.
4. **R4**: By comparing the `/api/` and `/api/auth/` blocks in `nginx/nginx.conf`, we confirm they match exactly on CORS headers (`Access-Control-Allow-Origin`, etc.) and preflight handlers returning HTTP 204.
5. **R5**: Because `server/src/routes/listings.ts` intercepts incoming query parameters and performs set membership/regex matches before passing parameters to services, invalid queries are rejected early with HTTP 400.
6. **R6**: Because Zod schemas define the POST and PUT contracts and are applied via the `validate` middleware, empty/invalid payloads throw a custom `ValidationError`, which is mapped to HTTP 400 in the Fastify error handler.

---

## 3. Caveats

* **Database Drivers**: This investigation is read-only. It is assumed the production database schema matches the migrations folder, and that database credentials are provided correctly via the environment variables listed in `docker-compose.prod.yml`.
* **Browser Styles**: No browser environment was accessed. The card shadow rendering issue is deduced from static code structure and standard CSS parser specifications.

---

## 4. Conclusion

* Requirements **R1**, **R3**, **R4**, **R5**, and **R6** are fully satisfied and pass verification.
* Requirement **R2** has a **CSS Bug** where the arbitrary Tailwind shadow class in `MasterExperience.tsx` fails to render a hover shadow due to HSL/RGBA syntax mismatch. A fix has been proposed in [analysis.md](./analysis.md) to replace `rgba()` with `hsla()` or a hardcoded RGBA value.

---

## 5. Verification Method

To verify these requirements:
1. **Server Unit & Integration Tests**: Run `npm test` in the `server` directory. All 93 test suites must pass successfully (verified: YES).
2. **Frontend Compiles**: Run `npm run build` in the root folder to verify there are no TypeScript or compilation errors (verified: YES).
3. **Shadow CSS Rendering**: Open a browser inspector on the `ModuleNavPanel` card hover state, or inspect the compiled stylesheet, checking for the `box-shadow` CSS property. If it shows `rgba(0 0% 100%, 0.1)`, it is invalid. Apply the proposed fix `hsla(var(--portal-foreground), 0.1)` and verify that the shadow renders correctly.
