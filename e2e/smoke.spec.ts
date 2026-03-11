/**
 * BErozgar — Full E2E Smoke Test
 *
 * Tests the complete user journey against the live local stack:
 *   1. Sign up (email + OTP)
 *   2. Verify OTP (read from DB since EMAIL_PROVIDER=log)
 *   3. Login
 *   4. Create listing + submit for review
 *   5. Admin approves listing
 *   6. Second user creates exchange request
 *   7. Seller accepts request
 *   8. Schedule meeting → Confirm exchange
 *   9. Raise dispute → Resolve dispute
 *  10. Verify trust score updates
 *  11. Logout
 *  12. Refresh token rotation
 *  13. Multi-tab session test
 *
 * Prerequisites:
 *   - PostgreSQL running on port 5433 (docker)
 *   - Server running on port 3001 (cd server && npm run dev)
 *   - Frontend running on port 8080 (npm run dev)
 *   - EMAIL_PROVIDER=log (default)
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import {
  getLatestOtp,
  ensureAdminUser,
  createVerifiedUser,
  cleanupE2eData,
  disconnectDb,
  getUserByEmail,
  getUserTrustData,
  getListingByTitle,
  getRequestForListing,
  db,
} from './helpers';

/* ═══════════════════════════════════════════════════
   Test Constants
   ═══════════════════════════════════════════════════ */

const API_BASE = 'http://127.0.0.1:3001';
const FRONTEND_BASE = 'http://127.0.0.1:8080';

const SELLER = {
  fullName: 'Test Seller',
  email: `e2e-seller-${Date.now()}@mctrgit.ac.in`,
  password: 'TestPass@123',
};

const BUYER = {
  fullName: 'Test Buyer',
  email: `e2e-buyer-${Date.now()}@mctrgit.ac.in`,
  password: 'TestPass@456',
};

const ADMIN = {
  email: `e2e-admin-${Date.now()}@mctrgit.ac.in`,
  password: 'AdminPass@789',
  fullName: 'Test Admin',
};

const LISTING = {
  title: `E2E Test Textbook ${Date.now()}`,
  description: 'Engineering Mathematics textbook, 3rd edition. Good condition with minimal highlighting.',
  price: '250',
  category: 'books',
};

/* ═══════════════════════════════════════════════════
   Shared State (across serial tests)
   ═══════════════════════════════════════════════════ */

let sellerAccessToken: string;
let buyerAccessToken: string;
let adminAccessToken: string;
let adminRefreshCookie: string;
let listingId: string;
let requestId: string;
let sellerId: string;
let buyerId: string;
let adminId: string;

/* ═══════════════════════════════════════════════════
   API Helpers
   ═══════════════════════════════════════════════════ */

/** Direct API call — bypasses browser for multi-user operations */
async function apiPost(
  request: APIRequestContext,
  path: string,
  data?: unknown,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (token) {
    const csrfToken = await getCsrfToken(request, token);
    headers['X-CSRF-Token'] = csrfToken;
    headers['Cookie'] = `_csrf=${encodeURIComponent(csrfToken)}`;
  }
  const res = await request.post(`${API_BASE}${path}`, {
    data,
    headers,
    timeout: 30000,
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function apiGet(
  request: APIRequestContext,
  path: string,
  token?: string,
) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await request.get(`${API_BASE}${path}`, {
    headers,
    timeout: 30000,
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function apiPatch(
  request: APIRequestContext,
  path: string,
  data: unknown,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (token) {
    const csrfToken = await getCsrfToken(request, token);
    headers['X-CSRF-Token'] = csrfToken;
    headers['Cookie'] = `_csrf=${encodeURIComponent(csrfToken)}`;
  }
  const res = await request.patch(`${API_BASE}${path}`, {
    data,
    headers,
    timeout: 30000,
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function getCsrfToken(
  request: APIRequestContext,
  token: string,
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const readToken = async () => {
    const res = await request.get(`${API_BASE}/api/auth/csrf-token`, { headers });
    expect(res.status()).toBe(200);

    const body = await res.json().catch(() => null) as { csrfToken?: string | null } | null;
    if (body?.csrfToken) {
      return body.csrfToken;
    }

    const setCookie = res.headers()['set-cookie'] ?? '';
    const cookieMatch = setCookie.match(/(?:^|,|;)\s*_csrf=([^;]+)/);
    return cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : null;
  };

  const firstAttempt = await readToken();
  if (firstAttempt) {
    return firstAttempt;
  }

  const secondAttempt = await readToken();
  expect(secondAttempt).toBeTruthy();
  return secondAttempt!;
}

/** Sign up + verify OTP via API, returns { accessToken, userId } */
async function signupViaApi(
  request: APIRequestContext,
  user: { fullName: string; email: string; password: string },
): Promise<{ accessToken: string; userId: string }> {
  // 1. Signup
  const signup = await apiPost(request, '/api/auth/signup', user);
  if (signup.status === 429) {
    const userId = await createVerifiedUser(user.email, user.password, user.fullName);
    const accessToken = await loginViaApi(request, user.email, user.password);
    return { accessToken, userId };
  }

  expect(signup.status).toBe(200);

  // 2. Read OTP from DB
  // Small delay to ensure OTP is persisted
  await new Promise((r) => setTimeout(r, 500));
  const otp = await getLatestOtp(user.email);
  expect(otp).toBeTruthy();

  // 3. Verify OTP
  const verify = await apiPost(request, '/api/auth/verify-otp', {
    email: user.email,
    fullName: user.fullName,
    password: user.password,
    otp,
  });
  expect(verify.status).toBe(201);
  expect(verify.body.accessToken).toBeTruthy();
  expect(verify.body.user.id).toBeTruthy();

  return {
    accessToken: verify.body.accessToken,
    userId: verify.body.user.id,
  };
}

/** Login via API, returns accessToken */
async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await apiPost(request, '/api/auth/login', { email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken;
}

/** Login via API, returns { accessToken, rawResponse } for cookie extraction */
async function loginViaApiRaw(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const rawRes = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(rawRes.status()).toBe(200);
  const body = await rawRes.json();
  const cookies = rawRes.headers()['set-cookie'] ?? '';
  return { accessToken: body.accessToken as string, cookies };
}

/* ═══════════════════════════════════════════════════
   E2E Test Suite — Full Lifecycle
   ═══════════════════════════════════════════════════ */

test.describe('BErozgar Full E2E Smoke Test', () => {
  test.describe.configure({ mode: 'serial' });

  /* ═══════════════════════════════════════════════════
     Setup / Teardown
     ═══════════════════════════════════════════════════ */

  test.beforeAll(async () => {
    // Verify the stack is running
    try {
      const res = await fetch(`${API_BASE}/health/ready`);
      const body = await res.json();
      if (body.status !== 'ready') {
        throw new Error(`API not ready: ${JSON.stringify(body)}`);
      }
    } catch (err) {
      throw new Error(
        `Cannot reach API at ${API_BASE}. Start the full stack first:\n` +
          `  1. docker compose up -d (postgres)\n` +
          `  2. cd server && npm run dev\n` +
          `  3. npm run dev (frontend)\n\n` +
          `Error: ${err}`,
      );
    }

    // Verify frontend is running
    try {
      const res = await fetch(FRONTEND_BASE);
      if (!res.ok) throw new Error(`Frontend returned ${res.status}`);
    } catch (err) {
      throw new Error(
        `Cannot reach frontend at ${FRONTEND_BASE}. Run: npm run dev\n\n` +
          `Error: ${err}`,
      );
    }

    // Clean up any leftover e2e data
    await cleanupE2eData();

    // Seed admin user
    adminId = await ensureAdminUser(ADMIN.email, ADMIN.password, ADMIN.fullName);
  });

  test.afterAll(async () => {
    await cleanupE2eData();
    await disconnectDb();
  });

  // ── 1. Health Check ──────────────────────────────
  test('1. API health endpoint returns ready', async ({ request }) => {
    const res = await apiGet(request, '/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
  });

  test('2. Full health report has database + stores', async ({ request }) => {
    const res = await apiGet(request, '/health?verbose=true');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.stores).toBeDefined();
  });

  // ── 2. Signup (Seller) via Browser ────────────────
  test('3. Seller signup — renders signup page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: 'REQUEST ACCESS' })).toBeVisible({ timeout: 15_000 });
  });

  test('4. Seller signup — email form interaction', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: 'REQUEST ACCESS' })).toBeVisible({ timeout: 15_000 });

    // Expand email form
    await page.getByText('or sign up with email').click();
    await page.waitForTimeout(500); // animation

    await page.getByPlaceholder('John Doe').fill('Signup Interaction User');
    await page.getByPlaceholder('you@mctrgit.ac.in').fill('signup-interaction@mctrgit.ac.in');
    await page.getByPlaceholder('••••••••').fill('TestPass@321');

    await expect(page.getByRole('button', { name: /REQUEST ACCESS/i })).toBeEnabled();
  });

  test('5. Seller OTP verification via browser', async ({ page }) => {
    await page.goto('/signup');
    await page.getByText('or sign up with email').click();
    await page.waitForTimeout(500);

    await page.getByPlaceholder('John Doe').fill(SELLER.fullName);
    await page.getByPlaceholder('you@mctrgit.ac.in').fill(SELLER.email);
    const passwordInput = page.getByPlaceholder('••••••••');
    await passwordInput.fill(SELLER.password);
    const signupResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/auth/signup')
      && response.request().method() === 'POST'
      && [200, 429].includes(response.status())
    ));
    await passwordInput.press('Enter');

    const signupResponse = await signupResponsePromise;
    if (signupResponse.status() === 429) {
      await createVerifiedUser(SELLER.email, SELLER.password, SELLER.fullName);

      await page.goto('/login');
      await page.getByRole('button', { name: 'USE LEGACY MAIL' }).click();
      await page.getByPlaceholder('YOU@MCTRGIT.AC.IN').fill(SELLER.email);
      await page.getByPlaceholder('••••••••').fill(SELLER.password);

      const loginResponsePromise = page.waitForResponse((response) => (
        response.url().includes('/api/auth/login')
        && response.request().method() === 'POST'
        && response.status() === 200
      ));
      await page.getByRole('button', { name: 'ENTER PORTAL' }).click();

      const loginResponse = await loginResponsePromise;
      const loginBody = await loginResponse.json() as {
        accessToken?: string;
        user?: { id?: string };
      };
      sellerAccessToken = loginBody.accessToken ?? '';
      sellerId = loginBody.user?.id ?? '';

      await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
      return;
    }

    await expect(page).toHaveURL(/\/verify/, { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Read OTP from database after browser signup created the pending registration
    const otp = await getLatestOtp(SELLER.email);
    expect(otp).toBeTruthy();

    const verifyResponsePromise = page.waitForResponse((response) => (
      response.url().includes('/api/auth/verify-otp')
      && response.request().method() === 'POST'
      && response.status() === 201
    ));

    // Focus the OTP input before typing so the real OTP control receives all digits.
    await page.getByRole('textbox').click();
    await page.keyboard.type(otp!);

    const verifyResponse = await verifyResponsePromise;
    const verifyBody = await verifyResponse.json() as {
      accessToken?: string;
      user?: { id?: string };
    };
    sellerAccessToken = verifyBody.accessToken ?? '';
    sellerId = verifyBody.user?.id ?? '';

    // Should redirect to /home after successful verification
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  // ── 3. Register Users via API for exchange lifecycle ──
  test('6. Register buyer via API (signup + OTP)', async ({ request }) => {
    const result = await signupViaApi(request, BUYER);
    buyerAccessToken = result.accessToken;
    buyerId = result.userId;
    expect(buyerAccessToken).toBeTruthy();
    expect(buyerId).toBeTruthy();
  });

  test('7. Get seller token via API login', async ({ request }) => {
    if (!sellerAccessToken) {
      sellerAccessToken = await loginViaApi(request, SELLER.email, SELLER.password);
    }
    if (!sellerId) {
      const user = await getUserByEmail(SELLER.email);
      sellerId = user!.id;
    }
    expect(sellerAccessToken).toBeTruthy();
    expect(sellerId).toBeTruthy();
  });

  test('8. Admin login via API', async ({ request }) => {
    const login = await loginViaApiRaw(request, ADMIN.email, ADMIN.password);
    adminAccessToken = login.accessToken;
    const refreshCookieMatch = login.cookies.match(/refresh_token=([^;]+)/);
    expect(refreshCookieMatch).toBeTruthy();
    adminRefreshCookie = refreshCookieMatch![1];
    expect(adminAccessToken).toBeTruthy();
    expect(adminRefreshCookie).toBeTruthy();
  });

  // ── 4. Create Listing ────────────────────────────
  test('9. Seller creates a listing via API', async ({ request }) => {
    const res = await apiPost(
      request,
      '/api/listings',
      {
        title: LISTING.title,
        description: LISTING.description,
        price: parseFloat(LISTING.price),
        category: LISTING.category,
      },
      sellerAccessToken,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(LISTING.title);
    expect(res.body.data.status).toBe('draft');
    listingId = res.body.data.id;
    expect(listingId).toBeTruthy();
  });

  test('10. Seller submits listing for review', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/listings/${listingId}/status`,
      { status: 'pending_review' },
      sellerAccessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toContain('pending');
  });

  // ── 5. Admin Approves Listing ─────────────────────
  test('11. Admin sees pending listing', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/pending', adminAccessToken);
    expect(res.status).toBe(200);
    const pending = Array.isArray(res.body) ? res.body : res.body.data ?? [];
    const found = pending.find((l: { id: string }) => l.id === listingId);
    expect(found).toBeTruthy();
  });

  test('12. Admin approves listing', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/listings/${listingId}/status`,
      { status: 'approved' },
      adminAccessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('approved');
  });

  // ── 6. Listing visible to public ──────────────────
  test('13. Approved listing appears in public list', async ({ request }) => {
    const res = await apiGet(request, '/api/listings?status=approved');
    expect(res.status).toBe(200);
    const listings = res.body.data ?? [];
    const found = listings.find((l: { id: string; title: string }) => l.id === listingId);
    expect(found).toBeTruthy();
    expect(found.title).toBe(LISTING.title);
  });

  test('14. Listing detail page via API', async ({ request }) => {
    // Verify the listing detail API works (browser test for listing detail
    // is unreliable: page.goto() loses SPA auth state on full reload)
    const res = await apiGet(request, `/api/listings/${listingId}`, buyerAccessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(LISTING.title);
    expect(res.body.data.id).toBe(listingId);
  });

  // ── 7. Create Exchange Request ─────────────────────
  test('15. Buyer creates exchange request via API', async ({ request }) => {
    const res = await apiPost(
      request,
      '/api/requests',
      { listingId },
      buyerAccessToken,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.status.toLowerCase()).toBe('sent');
    requestId = res.body.data.id;
    expect(requestId).toBeTruthy();
  });

  // ── 8. Exchange Lifecycle ──────────────────────────
  test('16. Seller accepts the request', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'ACCEPT' },
      sellerAccessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('accepted');
  });

  test('17. Schedule meeting', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'SCHEDULE' },
      sellerAccessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toContain('meeting');
  });

  test('18. Confirm exchange (completes it)', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'CONFIRM' },
      sellerAccessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('completed');
  });

  // ── 9. Verify Trust Updates ────────────────────────
  test('19. Seller completedExchanges incremented', async () => {
    const trust = await getUserTrustData(sellerId);
    expect(trust).toBeTruthy();
    expect(trust!.completedExchanges).toBeGreaterThanOrEqual(1);
  });

  // ── 10. Dispute Flow ───────────────────────────────
  test('20. Buyer raises dispute after completion', async ({ request }) => {
    // Transition to disputed
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'DISPUTE' },
      buyerAccessToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('disputed');
  });

  test('21. Create dispute record', async ({ request }) => {
    const res = await apiPost(
      request,
      '/api/disputes',
      {
        requestId,
        listingId,
        againstId: sellerId,
        type: 'ITEM_NOT_AS_DESCRIBED',
        description: 'E2E test dispute — item was not as described in the listing.',
      },
      buyerAccessToken,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.status.toLowerCase()).toBe('open');
  });

  test('22. Admin views disputes', async ({ request }) => {
    const res = await apiGet(request, '/api/disputes', adminAccessToken);
    expect(res.status).toBe(200);
    const disputes = res.body.data ?? [];
    expect(disputes.length).toBeGreaterThanOrEqual(1);
  });

  test('23. Admin resolves dispute (OPEN → UNDER_REVIEW → RESOLVED)', async ({ request }) => {
    const disputes = await apiGet(request, '/api/disputes', adminAccessToken);
    const dispute = (disputes.body.data ?? []).find(
      (d: { requestId: string; id: string }) => d.requestId === requestId,
    );
    expect(dispute).toBeTruthy();

    // Step 1: OPEN → UNDER_REVIEW (fires BEGIN_REVIEW event)
    const reviewRes = await apiPatch(
      request,
      `/api/disputes/${dispute.id}/status`,
      { status: 'UNDER_REVIEW' },
      adminAccessToken,
    );
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status.toLowerCase()).toBe('under_review');

    // Step 2: UNDER_REVIEW → RESOLVED (fires RESOLVE event)
    const resolveRes = await apiPatch(
      request,
      `/api/disputes/${dispute.id}/status`,
      { status: 'RESOLVED' },
      adminAccessToken,
    );
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status.toLowerCase()).toBe('resolved');
  });

  // ── 11. Auth: /me endpoint ─────────────────────────
  test('24. /auth/me returns current user with trust', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/me', sellerAccessToken);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(SELLER.email);
    expect(res.body.trust).toBeDefined();
    expect(res.body.trust.status).toBe('RESTRICTED');
    expect(res.body.restriction?.isRestricted).toBe(true);
  });

  // ── 12. Profile endpoint ───────────────────────────
  test('25. Profile endpoint returns user data', async ({ request }) => {
    const res = await apiGet(request, '/api/profile', sellerAccessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.identity.email).toBe(SELLER.email);
  });

  // ── 13. Admin Stats ────────────────────────────────
  test('26. Admin stats endpoint works', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/stats', adminAccessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(2);
    expect(res.body.data.totalListings).toBeGreaterThanOrEqual(1);
  });

  // ── 14. Refresh Token Rotation ─────────────────────
  test('27. Refresh token rotation works', async ({ request }) => {
    // Login to get a refresh token cookie
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: SELLER.email, password: SELLER.password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.status()).toBe(200);

    // Extract cookies from login response
    const cookies = loginRes.headers()['set-cookie'];
    expect(cookies).toBeTruthy();
    expect(cookies).toContain('refresh_token');

    // Parse the refresh_token cookie value
    const cookieMatch = cookies!.match(/refresh_token=([^;]+)/);
    expect(cookieMatch).toBeTruthy();
    const refreshCookie = cookieMatch![1];

    // Call refresh endpoint with the cookie
    const refreshRes = await request.post(`${API_BASE}/api/auth/refresh`, {
      headers: {
        Cookie: `refresh_token=${refreshCookie}`,
      },
    });
    expect(refreshRes.status()).toBe(200);
    const refreshBody = await refreshRes.json();
    expect(refreshBody.accessToken).toBeTruthy();

    // Should get a NEW refresh token cookie (rotation)
    const newCookies = refreshRes.headers()['set-cookie'];
    expect(newCookies).toContain('refresh_token');

    // The old refresh token should now be revoked
    // Using it again should fail (reuse detection)
    const reuseRes = await request.post(`${API_BASE}/api/auth/refresh`, {
      headers: {
        Cookie: `refresh_token=${refreshCookie}`,
      },
    });
    // Should be 401 (token revoked) — reuse detection triggered
    expect(reuseRes.status()).toBe(401);
  });

  // ── 15. Logout ─────────────────────────────────────
  test('28. Logout via browser flow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /MCTRGIT SINGLE SIGN-ON/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /USE LEGACY MAIL/i }).click();
    // Wait for email input to be visible before filling
    const emailInput = page.getByPlaceholder('YOU@MCTRGIT.AC.IN');
    await expect(emailInput).toBeVisible({ timeout: 5_000 });

    await emailInput.fill(SELLER.email);
    await page.getByPlaceholder('••••••••').fill(SELLER.password);
    await page.getByRole('button', { name: /ENTER PORTAL/i }).click();

    await expect(page).toHaveURL(/\/home/, { timeout: 30_000 });

    await page.getByRole('button', { name: /Logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  // ── 16. Protected routes redirect when logged out ──
  test('29. Protected routes redirect to login when unauthenticated', async ({ page }) => {
    // Use a fresh context (no cookies/tokens)
    await page.context().clearCookies();

    await page.goto('/home');
    // Should redirect to /login (ProtectedRoute)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ── 17. Idempotency ────────────────────────────────
  test('30. Idempotency key prevents duplicate creation', async ({ request }) => {
    const idempotencyUser = {
      fullName: 'E2E Idempotency Seller',
      email: `e2e-idempotency-${Date.now()}@mctrgit.ac.in`,
      password: 'Test1234!',
    };
    await createVerifiedUser(
      idempotencyUser.email,
      idempotencyUser.password,
      idempotencyUser.fullName,
    );

    const token = await loginViaApi(
      request,
      idempotencyUser.email,
      idempotencyUser.password,
    );
    const idempotencyKey = `e2e-idem-${Date.now()}`;
    const csrfToken = await getCsrfToken(request, token);

    // First request
    const res1 = await request.post(`${API_BASE}/api/listings`, {
      data: {
        title: 'Idempotent Test Item',
        description: 'Testing idempotency — this should only create one listing.',
        price: 100,
        category: 'electronics',
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Cookie: `_csrf=${encodeURIComponent(csrfToken)}`,
        'x-idempotency-key': idempotencyKey,
      },
    });
    expect(res1.status()).toBe(201);
    const body1 = await res1.json();

    // Second request with same key — should be replayed
    const res2 = await request.post(`${API_BASE}/api/listings`, {
      data: {
        title: 'Idempotent Test Item DUPLICATE',
        description: 'This should be ignored.',
        price: 999,
        category: 'books',
      },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Cookie: `_csrf=${encodeURIComponent(csrfToken)}`,
        'x-idempotency-key': idempotencyKey,
      },
    });
    // Should return same response as first
    expect(res2.status()).toBe(201);
    const body2 = await res2.json();
    expect(body2.data.id).toBe(body1.data.id);
    expect(body2.data.title).toBe('Idempotent Test Item');

    // Check for replay header
    const replayHeader = res2.headers()['x-idempotency-replay'];
    expect(replayHeader).toBe('true');
  });

  // ── 18. Rate Limiting ──────────────────────────────
  test('31. Rate limiting is enforced', async ({ request }) => {
    // Use an endpoint with an explicit per-route cap so the assertion stays
    // deterministic across environments. GET /api/admin/fraud is capped at
    // 20 requests per hour for authenticated admins.
    let rateLimitedCount = 0;

    for (let batchStart = 0; batchStart < 30 && rateLimitedCount === 0; batchStart += 5) {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request.get(`${API_BASE}/api/admin/fraud`, {
            headers: { Authorization: `Bearer ${adminAccessToken}` },
            timeout: 30000,
          }),
        ),
      );

      rateLimitedCount += responses.filter((response) => response.status() === 429).length;
    }

    expect(rateLimitedCount).toBeGreaterThan(0);
  });

  // ── 19. Security Headers ───────────────────────────
  test('32. Security headers are present', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    const headers = res.headers();
    // Helmet should set these
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeTruthy();
  });

  // ── 20. Error Handling ─────────────────────────────
  test('33. 404 for non-existent listing', async ({ request }) => {
    const res = await apiGet(request, '/api/listings/00000000-0000-0000-0000-000000000000', buyerAccessToken);
    expect(res.status).toBe(404);
  });

  test('34. CSRF blocks unauthenticated protected mutation', async ({ request }) => {
    const res = await apiPost(request, '/api/listings', {
      title: 'Unauthorized',
      price: 0,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  test('35. 403 for non-admin on admin route', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/pending', buyerAccessToken);
    expect(res.status).toBe(403);
  });

  // ── 21. Landing Page Renders ───────────────────────
  test('36. Landing page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForTimeout(3000); // let animations settle

    // No unhandled JS errors
    expect(errors).toEqual([]);
  });

  // ── 22. No Console Errors on Protected Pages ──────
  test('37. Home page has no console errors', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByRole('button', { name: /USE LEGACY MAIL/i }).click();
    const emailInput37 = page.getByPlaceholder('YOU@MCTRGIT.AC.IN');
    await expect(emailInput37).toBeVisible({ timeout: 5_000 });
    await emailInput37.fill(BUYER.email);
    await page.getByPlaceholder('••••••••').fill(BUYER.password);
    await page.getByRole('button', { name: /ENTER PORTAL/i }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 30_000 });

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/home');
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors (e.g. WebGL warnings, worker init on CI)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('WebGL') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Worker module function'),
    );
    expect(criticalErrors).toEqual([]);
  });

  // ── 23. Admin Page Access ──────────────────────────
  test('38. Admin can access admin page via browser', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'refresh_token',
        value: adminRefreshCookie,
        url: `${API_BASE}/api/auth`,
      },
    ]);

    await page.addInitScript((adminUser) => {
      localStorage.setItem('berozgar_auth', JSON.stringify(adminUser));
    }, {
      id: adminId,
      fullName: ADMIN.fullName,
      email: ADMIN.email,
      role: 'admin',
      verified: true,
      provider: 'EMAIL',
      privilegeLevel: 'SUPER',
    });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });

    // Verify we're on the admin page and not redirected to login
    const url = page.url();
    expect(url).toContain('/admin');
  });

  // ── 24. Analytics Event Ingestion ──────────────────
  test('39. Analytics endpoint accepts events', async ({ request }) => {
    const csrfRes = await request.get(`${API_BASE}/api/auth/csrf-token`);
    expect(csrfRes.status()).toBe(200);

    const csrfBody = await csrfRes.json().catch(() => null) as { csrfToken?: string | null } | null;
    const csrfToken = csrfBody?.csrfToken
      ?? (() => {
        const setCookie = csrfRes.headers()['set-cookie'] ?? '';
        const cookieMatch = setCookie.match(/(?:^|,|;)\s*_csrf=([^;]+)/);
        return cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : '';
      })();
    expect(csrfToken).toBeTruthy();

    const res = await request.post(`${API_BASE}/api/analytics/events`, {
      data: {
        events: [
          {
            name: 'e2e_test_event',
            level: 'info',
            timestamp: Date.now(),
            properties: { test: true },
          },
        ],
      },
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Cookie: `_csrf=${encodeURIComponent(csrfToken)}`,
      },
    });
    // Analytics returns 202 Accepted
    expect(res.status()).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
  });

  // ── 25. Concurrent Modification Safety ─────────────
  test('40. Optimistic lock prevents stale writes', async ({ request }) => {
    // Seller's rate-limit bucket is exhausted from test 31 (100/60s global).
    // Use buyer as listing owner, admin as exchange requester — neither is rate-limited.
    const ownerToken = buyerAccessToken;
    const requesterToken = adminAccessToken;

    // Create a new listing (buyer acts as owner here)
    const newListing = await apiPost(
      request,
      '/api/listings',
      {
        title: 'Concurrency Test Item',
        description: 'Testing optimistic locking on exchange requests.',
        price: 150,
        category: 'books',
      },
      ownerToken,
    );
    expect(newListing.status).toBe(201);
    const newListingId = newListing.body.data.id;

    // Submit for review + approve (admin approves)
    await apiPatch(request, `/api/listings/${newListingId}/status`, { status: 'pending_review' }, ownerToken);
    await apiPatch(request, `/api/listings/${newListingId}/status`, { status: 'approved' }, adminAccessToken);

    // Admin creates exchange request on buyer's listing
    const reqRes = await apiPost(request, '/api/requests', { listingId: newListingId }, requesterToken);
    expect(reqRes.status).toBe(201);
    const newReqId = reqRes.body.data.id;
    const version = reqRes.body.data.version;

    // Owner (buyer) accepts with correct version
    const accept = await apiPatch(
      request,
      `/api/requests/${newReqId}/event`,
      { event: 'ACCEPT', version },
      ownerToken,
    );
    expect(accept.status).toBe(200);

    // Try to accept again with stale version (should fail)
    const staleAccept = await apiPatch(
      request,
      `/api/requests/${newReqId}/event`,
      { event: 'ACCEPT', version },
      ownerToken,
    );
    // Should be 409 (conflict) or 400 (invalid transition — already accepted)
    expect([400, 409]).toContain(staleAccept.status);
  });
});
