# APODEX continuation (m) - dependency security remediation

Starting point: main `e38786b` (PR #15). Implements the top recommendation of continuation (l): triage and remediate dependency advisories with regression tests, without `npm audit fix --force`.

## Changes
- Server runtime: `@fastify/static` 9 -> ^10.1.5 (path-traversal / route-guard bypass, GHSA-83w8-p2f5-377r, GHSA-8pvw-jcv7-9cmj).
- Server runtime: `nodemailer` 8 -> ^10.0.11 (raw-option file read/SSRF, IDN allow-list bypass, addressparser DoS). Existing `createTransport`/`sendMail` usage compiles and tests unchanged.
- Server: npm `overrides` for `effect ^3.20.0`, `deepmerge-ts ^8.0.0`, `uuid ^11.1.1` (transitive via prisma CLI / gaxios); `esbuild` dev pin 0.27.3 -> 0.28.2.
- Frontend runtime: `react-router-dom` 6 -> ^7.18.4 (open redirect via backslash, SSR constructor injection). Removed the v6-only `future` prop on `BrowserRouter`; both flags are default behaviour in v7.
- Both lockfiles refreshed with semver-compatible `npm audit fix`.

## Audit results
| Scope | Before (l) | After (m) |
|---|---|---|
| Frontend runtime (`--omit=dev`) | 11 (5 high) | **0** |
| Server runtime (`--omit=dev`) | 15 (11 high) | **0** |
| Frontend full | 22 | 4 dev-only (vite/esbuild dev server, vitest mocker) |
| Server full | 22 | 3 dev-only (vitest mocker, low/moderate) |

Remaining items are dev/test tooling only (Vite 5->8 and Vitest 3->4 majors); schedule as a separate PR.

## Validation (local, Node 25)
- Frontend: vitest 581/581 passed (28 files); `tsc -p tsconfig.app.json` passed; `vite build` passed.
- Server: `prisma generate` OK (v6.19.2); `tsc --noEmit` passed; esbuild bundle passed; vitest 172 passed, 11 DB tests skipped (run in CI PostgreSQL job).

## Rollout / rollback
No schema changes. Deploy normally; smoke-test static asset serving (incl. `/..%2f` style paths returning 404), password-reset/OTP email delivery and client-side navigation. Rollback = redeploy previous commit.

## Still required before launch
Rotate the GitHub token pasted in chat; production hosting/DNS/secrets, backups, monitoring; campus pilot. No traction claims are made.
