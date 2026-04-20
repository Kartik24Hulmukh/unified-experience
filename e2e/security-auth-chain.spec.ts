import { test, expect, type APIRequestContext } from '@playwright/test';
import { createVerifiedUser, cleanupE2eData, disconnectDb } from './helpers';

const WEB = (process.env.E2E_WEB_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const API = (process.env.E2E_API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const RUN_ID = Date.now();

const USER = {
  fullName: 'E2E Security Chain User',
  email: `e2e-security-chain-${RUN_ID}@mctrgit.ac.in`,
  password: 'ChainPass@123',
};

function extractAccessToken(payload: unknown): string {
  const body = (payload ?? {}) as Record<string, unknown>;
  const data = (body.data ?? {}) as Record<string, unknown>;
  const topUser = (body.user ?? data.user ?? null) as Record<string, unknown> | null;
  const nestedUser = (topUser?.user ?? null) as Record<string, unknown> | null;
  const effectiveUser = nestedUser ?? topUser;

  const fromTop = typeof body.accessToken === 'string' ? body.accessToken : '';
  const fromData = typeof data.accessToken === 'string' ? data.accessToken : '';
  const fromUser = typeof topUser?.accessToken === 'string' ? topUser.accessToken : '';
  const fromNested = typeof effectiveUser?.accessToken === 'string' ? effectiveUser.accessToken : '';

  return fromTop || fromData || fromUser || fromNested || '';
}

function extractCookieValue(setCookieHeader: string | undefined, cookieName: string): string {
  const raw = setCookieHeader ?? '';
  const match = raw.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1] ?? '';
}

async function getCsrfToken(
  request: APIRequestContext,
  accessToken: string,
): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const readFromPath = async (path: string): Promise<string> => {
    const res = await request.get(`${API}${path}`, { headers, timeout: 15000 });
    const body = await res.json().catch(() => null) as { csrfToken?: string | null } | null;
    if (body?.csrfToken) return body.csrfToken;

    const setCookie = res.headers()['set-cookie'] ?? '';
    const cookieValue = extractCookieValue(setCookie, '_csrf');
    return decodeURIComponent(cookieValue || '');
  };

  const fromStorageState = async (): Promise<string> => {
    const state = await request.storageState();
    return state.cookies.find((cookie) => cookie.name === '_csrf')?.value ?? '';
  };

  const candidates = ['/api/auth/csrf-token', '/health', '/api/auth/me'];
  for (const path of candidates) {
    const token = await readFromPath(path).catch(() => '');
    if (token) return token;
  }

  return fromStorageState().catch(() => '');
}

test.describe('Security auth chain (browser-level)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await createVerifiedUser(USER.email, USER.password, USER.fullName);
  });

  test.afterAll(async () => {
    await cleanupE2eData();
    await disconnectDb();
  });

  test('login -> refresh -> me -> csrf protected mutation -> logout', async ({ page, context, request }) => {
    await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });

    const legacyToggle = page.getByRole('button', { name: /USE LEGACY MAIL/i });
    if (await legacyToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await legacyToggle.click();
    }

    await page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first().fill(USER.email);
    await page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]').first().fill(USER.password);

    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
      { timeout: 20000 },
    );

    await page.getByRole('button', { name: /ENTER PORTAL|LOGIN|SIGN IN/i }).first().click();

    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);

    const loginBody = await loginResponse.json().catch(() => null);
    const loginAccessToken = extractAccessToken(loginBody);
    expect(loginAccessToken).toBeTruthy();
    expect(JSON.stringify(loginBody)).not.toContain('refreshToken');

    await expect(page).toHaveURL(/\/(home|profile|admin)(\/|$)/, { timeout: 20000 });

    const apiLoginResponse = await context.request.post(`${API}/api/auth/login`, {
      data: { email: USER.email, password: USER.password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(apiLoginResponse.status()).toBe(200);

    const loginSetCookie = apiLoginResponse.headers()['set-cookie'] ?? '';
    const refreshToken = extractCookieValue(loginSetCookie, 'refresh_token');
    expect(refreshToken).toBeTruthy();
    expect(loginSetCookie).toMatch(/HttpOnly/i);
    expect(loginSetCookie).toMatch(/SameSite=Strict/i);
    expect(loginSetCookie).toMatch(/Path=\/api\/auth/i);

    const refreshResponse = await context.request.post(`${API}/api/auth/refresh`, {
      headers: {
        Cookie: `refresh_token=${refreshToken}`,
      },
    });
    expect(refreshResponse.status()).toBe(200);
    const refreshBody = await refreshResponse.json().catch(() => null);
    const refreshedAccessToken = extractAccessToken(refreshBody);
    expect(refreshedAccessToken).toBeTruthy();
    expect(JSON.stringify(refreshBody)).not.toContain('refreshToken');

    const refreshSetCookie = refreshResponse.headers()['set-cookie'] ?? '';
    const rotatedRefreshToken = extractCookieValue(refreshSetCookie, 'refresh_token') || refreshToken;

    const meResponse = await context.request.get(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${refreshedAccessToken}` },
    });
    expect(meResponse.status()).toBe(200);

    const csrfToken = await getCsrfToken(request, refreshedAccessToken);
    expect(csrfToken).toBeTruthy();

    const protectedPath = `${API}/api/profile/link-college-email`;

    const missingHeader = await context.request.post(protectedPath, {
      headers: {
        Authorization: `Bearer ${refreshedAccessToken}`,
        Cookie: `_csrf=${encodeURIComponent(csrfToken)}`,
      },
    });
    expect(missingHeader.status()).toBe(403);

    const mismatched = await context.request.post(protectedPath, {
      headers: {
        Authorization: `Bearer ${refreshedAccessToken}`,
        Cookie: `_csrf=${encodeURIComponent(csrfToken)}`,
        'X-CSRF-Token': `${csrfToken}-tampered`,
      },
    });
    expect(mismatched.status()).toBe(403);

    const validCsrf = await context.request.post(protectedPath, {
      headers: {
        Authorization: `Bearer ${refreshedAccessToken}`,
        Cookie: `_csrf=${encodeURIComponent(csrfToken)}`,
        'X-CSRF-Token': csrfToken,
      },
    });
    expect(validCsrf.status()).not.toBe(403);

    const logoutResponse = await context.request.post(`${API}/api/auth/logout`, {
      headers: {
        Cookie: `refresh_token=${rotatedRefreshToken}`,
      },
    });
    expect(logoutResponse.status()).toBe(200);

    const postLogoutRefresh = await context.request.post(`${API}/api/auth/refresh`, {
      headers: {
        Cookie: `refresh_token=${rotatedRefreshToken}`,
      },
    });
    expect(postLogoutRefresh.status()).toBe(401);
  });
});