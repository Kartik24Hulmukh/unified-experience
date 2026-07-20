# Production Fixes — rgitrozgar.in

Every fix applied in this pass, why it mattered in production, and what to
verify after deploying.

---

## Critical fixes (features that were broken in production)

### 1. Google Sign-In was blocked by the HTML CSP — `index.html`
The `<meta>` Content-Security-Policy did not allow `https://accounts.google.com`
in `script-src`, `connect-src`, or `frame-src`. Browsers enforce the STRICTER
of the meta CSP and the nginx header CSP, so even though nginx allowed Google,
the Google Identity Services script could never load — Google login silently
failed for all users. Also added `https:` to `img-src` so Google profile
photos and remote images render.

### 2. Every image upload failed with 413 — `server/src/app.ts` + `server/src/routes/images.ts`
The Fastify app had a global `bodyLimit` of **10 KB**. Fastify enforces this
against `Content-Length` **before** multipart parsing, so the advertised 5 MB
image upload limit was unreachable — every listing photo upload was rejected.
**Fix:** 64 KB global JSON limit + per-route 6 MB limit on the upload route.

### 3. All listing photos returned index.html instead of the image — `nginx/nginx.conf`
The backend serves uploaded images at `/uploads/<file>`, but nginx had no
`/uploads/` location, so the SPA catch-all served `index.html` for every
image URL. **Fix:** added a `/uploads/` proxy block with a 7-day cache.

### 4. Uploaded photos were DELETED on every redeploy — `docker-compose.prod.yml` + `server/Dockerfile`
Images lived on the API container's ephemeral filesystem with no volume, so
every deploy wiped all user photos. **Fix:** persistent `uploads-data` volume
at `/app/server/uploads`; Dockerfile pre-creates the dir owned by the
non-root `node` user (otherwise the volume is root-owned → EACCES on upload).

### 5. The API Docker image could not build at all — `docker-compose.prod.yml` + `server/Dockerfile`
The compose file built the API with `context: ./server`, but
`server/package.json` depends on `"@berozgar/shared": "file:../shared"` —
outside that context — so `npm ci` inside the image always failed.
**Fix:** build context is now the repo root and the Dockerfile copies
`shared/` to `/app/shared` so the file dependency resolves.

### 6. Duplicate CORS headers broke cross-origin API responses — `nginx/nginx.conf`
Both nginx AND the Fastify backend emitted `Access-Control-Allow-Origin`.
Browsers treat duplicate ACAO headers as a CORS failure and block the
response (e.g. when the site is opened via the `www.` origin).
**Fix:** nginx no longer sets CORS headers; the backend's @fastify/cors
(origin allowlist via `CORS_ORIGIN`) is the single source of truth. Security
headers are re-declared inside `/api/` locations because nginx `add_header`
in a location block REPLACES inherited headers.

### 7. Standalone frontend Docker image crash-looped — `Dockerfile` + `nginx/default.conf` (new)
The root Dockerfile copied `nginx/nginx.conf` (a FULL top-level config) into
`/etc/nginx/conf.d/default.conf`, which is invalid there. It also hard-copied
the gitignored `.env.production`, breaking builds from clean clones.
**Fix:** new `nginx/default.conf` server-block config for the standalone
image; removed the hard `.env.production` COPY.

### 8. Server crashed at boot when Sentry was configured — `server/src/app.ts`
`require('@sentry/node')` inside an ES module (`"type": "module"`) crashes
because `require` is undefined. **Fix:** guarded dynamic `import()` that
still degrades gracefully when the package is absent.

---

## Quality / debuggability fixes

### 9. Production builds stripped `console.error` — `vite.config.ts`
All console output including errors was removed from production bundles,
making user-facing failures impossible to diagnose. Now only
`log/debug/info` and `debugger` are stripped.

### 10. Stale scheduling comment — `server/src/server.ts`
Comment said the stale-recovery job runs "every 6h" while the code runs it
every 30 minutes. Corrected.

---

## Deploy checklist (DigitalOcean)

1. Push these changes to the remote repo, then `git pull` on the droplet.
2. Rebuild the frontend: `npm ci && npm run build` (produces `dist/` that
   docker-compose mounts into nginx).
3. Rebuild + restart the stack:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
4. Verify:
   - `https://rgitrozgar.in/health` returns `{"status":"ok"}`
   - Google Sign-In loads and completes login
   - Create a listing with a photo → it uploads and renders
   - Redeploy once more and confirm previously uploaded photos survive

### Required `.env.production` values (server-side)
- `POSTGRES_PASSWORD`, `JWT_SECRET` (min 32 chars)
- `GOOGLE_CLIENT_ID` (same value as the frontend `VITE_GOOGLE_CLIENT_ID`)
- `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (or SMTP settings) — otherwise
  OTP emails are only logged and signups appear broken to users
- `CORS_ORIGIN=https://rgitrozgar.in` (add `https://www.rgitrozgar.in` too if
  users may load the site via www)
