# Original User Request

## Initial Request — 2026-07-08T17:21:03+05:30

Fix and verify critical production bugs and UI regressions in the BErozgar (rgitrozgar.in) campus platform. Compile-time fixes have been applied locally. The team must audit the codebase, run verify checks, and ensure no additional regressions exist.

Working directory: c:\Users\praja\OneDrive\Desktop\Berozgar\unified-experience
Integrity mode: development

## Requirements

### R1. Verify database migration container startup setup
Ensure `server/Dockerfile` CMD runs `npx prisma migrate deploy` before `node dist/server.cjs` and that it runs correctly on a clean setup.

### R2. Verify dark mode readability on MasterExperience
Ensure cards inside the MasterExperience portal section have theme-neutral dark overlays and correct contrast, and that index.css portal color tokens are correct.

### R3. Verify Nginx configurations
Ensure `nginx/nginx.conf` `/api/auth/` location block has correct CORS headers and OPTIONS preflight handlers matching the `/api/` block.

### R4. Verify routing query parameter validation
Ensure listings routes validate query parameters (`status`, `module`, `cursor`) and return 400 Bad Request on invalid parameters instead of 500.

### R5. Verify admin body input validation
Ensure POST and PUT admin endpoints for mess and hospital routes are fully validated using Zod schemas.

## Acceptance Criteria

### Backend
- [ ] `GET /api/listings?module=INVALID` returns 400 with a descriptive error message
- [ ] `GET /api/listings?status=INVALID` returns 400 with a descriptive error message
- [ ] `POST /api/mess` with an empty body returns 400 (not 500)
- [ ] `POST /api/hospitals` with an empty body returns 400 (not 500)
- [ ] All existing server tests pass (`cd server && npm test`)

### Frontend
- [ ] `npm run build` succeeds with no errors
- [ ] Opening the hamburger menu sets `document.body.style.overflow` to `'hidden'`
- [ ] Closing the hamburger menu restores original body overflow

### Nginx
- [ ] `/api/auth/` location block includes `Access-Control-Allow-Origin` header
- [ ] `/api/auth/` location block returns 204 for OPTIONS requests
