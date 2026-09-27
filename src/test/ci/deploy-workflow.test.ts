import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guards the three deploy.yml defects fixed in APODEX continuation (d).
// Resolved from this file's location so the suite passes from any cwd.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const deploy = readFileSync(resolve(root, '.github/workflows/deploy.yml'), 'utf8');
const compose = readFileSync(resolve(root, 'docker-compose.prod.yml'), 'utf8');

describe('deploy pipeline contract', () => {
  it('does not depend on a registry image that CI never publishes', () => {
    expect(deploy).not.toMatch(/docker pull/);
    expect(deploy).not.toMatch(/ghcr\.io/);
    expect(deploy).toMatch(/\$COMPOSE build api/);
    expect(compose).toMatch(/image: berozgar-api:\$\{API_IMAGE_TAG:-latest\}/);
  });

  it('health-checks the api inside the container network, not host port 3001', () => {
    expect(compose).toMatch(/expose:\s*\n\s*- "3001"/);
    expect(deploy).not.toMatch(/curl[^\n]*localhost:3001/);
    expect(deploy).toMatch(/exec -T api wget -qO- http:\/\/localhost:3001\/health\/ready/);
  });

  it('requires the client build and ships it to the VPS', () => {
    expect(deploy).not.toMatch(/continue-on-error/);
    expect(deploy).toMatch(/appleboy\/scp-action/);
    expect(deploy).toMatch(/test -f dist\/index.html/);
    expect(deploy).toMatch(/cp -a "releases\/dist-\$SHA\/\." dist\//);
  });

  it('backs up the database and migrates with the new image before restart', () => {
    const dump = deploy.indexOf('pg_dump');
    const migrate = deploy.indexOf('prisma migrate deploy');
    const restart = deploy.indexOf('up -d --no-build --remove-orphans');
    expect(dump).toBeGreaterThan(0);
    expect(migrate).toBeGreaterThan(dump);
    expect(restart).toBeGreaterThan(migrate);
  });
});
