# APODEX continuation (d): deploy pipeline repaired (owner item #3)

Date: 27 September 2026. Base: `main@90fcede` (after PR #3).

## Defects fixed in `.github/workflows/deploy.yml`
| Defect | Before | After |
|---|---|---|
| Registry image CI never publishes | `docker pull ghcr.io/.../api:latest \|\| true`, then built anyway; rollback retagged a non-existent image | Image built on the VPS and tagged `berozgar-api:<sha>` (`image:` added to `docker-compose.prod.yml`); `.deployed-tag` records the live tag for rollback |
| Wrong health-check target | `curl localhost:3001` from the host, but api only `expose`s 3001, so every deploy timed out and rolled back | `compose exec -T api wget localhost:3001/health/ready` inside the network, then nginx `/health` end to end |
| client-dist never shipped | Artifact downloaded onto the runner with `continue-on-error`, never copied; nginx served a stale `./dist` | Artifact required, `dist/index.html` verified, tarball scp-ed to `releases/`, published in place (old hashed assets kept for open tabs) |
| Migrations ran on the OLD image before build | `run --rm api prisma migrate deploy` then `up --build` | build -> `pg_dump` backup -> migrate with new image -> restart |
| Rollback | `git checkout HEAD~1 -- docker-compose.prod.yml` | previous SHA + previous image tag + previous dist restored; dump path printed (schema is forward-only) |
| Unconfigured repo | Every push to main produced a red Deploy run | Preflight skips cleanly with a step summary when VPS secrets are absent |

## Validation
| Check | Result |
|---|---|
| `src/test/ci/deploy-workflow.test.ts` (new, 4 contract tests) | pass |
| Full frontend vitest (run from repo root) | 22 files, 550 tests pass (incl. `admin-route-aliases`) |
| YAML parse of deploy.yml + docker-compose.prod.yml, `bash -n` on every embedded script | pass |
| Real VPS rollout | NOT run: no VPS/secrets in this sandbox. First real deploy must be watched |

## Premortem
| Failure | Mitigation |
|---|---|
| First deploy has no previous tag | rollback falls back to `latest`; watch the first run manually |
| Bad migration corrupts data | `backups/pre-<sha>.dump` taken right before `migrate deploy`; restore with `pg_restore` |
| VPS disk fills with builds/dumps | keep last 5 tarballs, 14 days of dumps, prune images older than 7 days |
| Artifact expired (7-day retention) for a re-run | deploy fails loudly instead of shipping stale SPA; re-run CI |

## Still open (owner action)
1. **Revoke and rotate the GitHub PAT** - it was pasted again and used for this PR.
2. Add secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH`, `DEPLOY_ENV_FILE`; point DNS for rgitrozgar.in; rehearse migrations on a restored backup.
3. `tsc -p tsconfig.app.json` reports pre-existing strict-type errors (e.g. `SignupPage.tsx`, `VerificationPage.tsx`); `vite build` is unaffected. Next PR.
4. Campus Q&A over a reviewed public document set, then a pilot with pre-agreed metrics. No traction numbers are claimed.
