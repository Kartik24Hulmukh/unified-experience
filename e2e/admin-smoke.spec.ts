import { test, expect, type Page } from '@playwright/test';

const BASE_URL = (process.env.E2E_WEB_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const ADMIN_CREDENTIALS = {
  email: 'kartikhulmukh24@gmail.com',
  password: 'Kartik24@',
};

const readRoleDeep = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const direct = typeof obj.role === 'string' ? obj.role : null;
  if (direct) return direct;
  for (const key of Object.keys(obj)) {
    const nested = obj[key];
    if (nested && typeof nested === 'object') {
      const role = readRoleDeep(nested);
      if (role) return role;
    }
  }
  return null;
};

async function probeRole(page: Page, accessToken: string) {
  const storageRole = await page.evaluate(() => {
    const readRole = (value: unknown): string | null => {
      if (!value || typeof value !== 'object') return null;
      const obj = value as Record<string, unknown>;
      const direct = typeof obj.role === 'string' ? obj.role : null;
      if (direct) return direct;
      for (const key of Object.keys(obj)) {
        const nested = obj[key];
        if (nested && typeof nested === 'object') {
          const role = readRole(nested);
          if (role) return role;
        }
      }
      return null;
    };

    try {
      const raw = localStorage.getItem('berozgar_auth');
      return raw ? readRole(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });

  const meRes = await page.request.get(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });

  let meRole: string | null = null;
  if (meRes.ok()) {
    const meBody = await meRes.json().catch(() => null);
    meRole = readRoleDeep(meBody);
  }

  const hasRefreshCookie = (await page.context().cookies()).some((cookie) => cookie.name === 'refresh_token');
  return { storageRole, meStatus: meRes.status(), meRole, hasRefreshCookie };
}

test('admin can stay on /admin after login', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  const legacyToggle = page.getByRole('button', { name: /USE LEGACY MAIL/i });
  if (await legacyToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    await legacyToggle.click();
  }

  const emailInput = page.locator('input[placeholder*="mctrgit"], input[type="email"], input[name="email"], input[autocomplete="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]');
  const loginButton = page.getByRole('button', { name: /ENTER PORTAL|Login|Sign In/i }).first();

  await expect(emailInput.first()).toBeVisible({ timeout: 15000 });
  await expect(passwordInput.first()).toBeVisible({ timeout: 15000 });
  await emailInput.first().fill(ADMIN_CREDENTIALS.email);
  await passwordInput.first().fill(ADMIN_CREDENTIALS.password);

  let loginStatus = 0;
  let accessToken: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await loginButton.click();
    const loginResponse = await loginResponsePromise;
    loginStatus = loginResponse.status();
    if (loginStatus === 200) {
      const body = await loginResponse.json().catch(() => null) as Record<string, unknown> | null;
      const tokenCandidate = body && typeof body.accessToken === 'string' ? body.accessToken : null;
      if (!tokenCandidate) {
        throw new Error('Admin login response missing accessToken; cannot validate session.');
      }
      accessToken = tokenCandidate;
      break;
    }
    if (loginStatus !== 429) {
      const body = await loginResponse.text().catch(() => '');
      throw new Error(`Admin login failed with status ${loginStatus}. Response: ${body.slice(0, 300)}`);
    }
    await page.waitForTimeout(2000 * (attempt + 1));
  }
  expect(loginStatus).toBe(200);
  expect(accessToken).toBeTruthy();

  await page.waitForURL(/\/(admin|home|profile|login)/, { timeout: 30000 });

  const roleProbe = await probeRole(page, accessToken as string);
  console.log('ADMIN_SMOKE_ROLE_PROBE', roleProbe);
  expect(roleProbe.meStatus).toBe(200);
  expect((roleProbe.meRole ?? '').toLowerCase()).toBe('admin');

  let landedOnAdmin = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    if (/\/admin(\/|$)/.test(new URL(page.url()).pathname)) {
      landedOnAdmin = true;
      break;
    }
    await page.waitForTimeout(1000 * (attempt + 1));
  }

  const finalUrl = page.url();
  console.log('ADMIN_SMOKE_URL', finalUrl);

  expect(landedOnAdmin).toBeTruthy();
  expect(roleProbe.hasRefreshCookie).toBeTruthy();
  await expect(page).toHaveURL(/\/admin(\/|$)/);
});
