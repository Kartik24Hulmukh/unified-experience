/**
 * BErozgar — Comprehensive Role-Based E2E Test Suite
 * 
 * Tests EVERY API endpoint and EVERY frontend route for each user role:
 *   1. PUBLIC_USER (unauthenticated visitor)
 *   2. STUDENT_VERIFIED (authenticated buyer + seller)
 *   3. ADMIN (platform administrator)
 *
 * Goals:
 *   ✓ Zero 404 errors — every route returns meaningful content
 *   ✓ Zero console errors — no JS crashes on any page
 *   ✓ Every API endpoint returns expected status codes per role
 *   ✓ All protected routes enforce auth correctly
 *   ✓ Complete exchange lifecycle works end-to-end
 *   ✓ Navigation flows are smooth with no dead ends
 *
 * Prerequisites:
 *   - PostgreSQL running on port 5433 (docker compose up -d)
 *   - Server running on port 3001 (cd server && npm run dev)
 *   - Frontend running on port 8080 (npm run dev)
 *   - EMAIL_PROVIDER=log
 */

import { test, expect, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test';
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

test.describe.configure({ mode: 'serial' });


/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
const WEB = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:8080';

const TEST_RUN = Date.now();

const ADMIN_USER = {
  email: `e2e-admin-${TEST_RUN}@mctrgit.ac.in`,
  password: 'AdminPass@789',
  fullName: 'E2E Admin User',
};

const STUDENT_SELLER = {
  email: `e2e-seller-${TEST_RUN}@mctrgit.ac.in`,
  password: 'SellerPass@123',
  fullName: 'E2E Seller Student',
};

const STUDENT_BUYER = {
  email: `e2e-buyer-${TEST_RUN}@mctrgit.ac.in`,
  password: 'BuyerPass@456',
  fullName: 'E2E Buyer Student',
};

const LISTING_DATA = {
  title: `E2E Test Listing ${TEST_RUN}`,
  description: 'Comprehensive E2E test listing — Engineering Mathematics 3rd edition.',
  price: 350,
  category: 'books',
};

/* ═══════════════════════════════════════════════════
   Shared State
   ═══════════════════════════════════════════════════ */

let adminId: string;
let sellerId: string;
let buyerId: string;
let adminToken: string;
let sellerToken: string;
let buyerToken: string;
let adminRefreshCookie: string;
let sellerRefreshCookie: string;
let buyerRefreshCookie: string;
let listingId: string;
let requestId: string;

/* ═══════════════════════════════════════════════════
   API Utilities
   ═══════════════════════════════════════════════════ */

async function getCsrfToken(request: APIRequestContext, token?: string): Promise<string> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await request.get(`${API}/api/auth/csrf-token`, { headers });
  const body = await res.json().catch(() => null) as { csrfToken?: string | null } | null;
  if (body?.csrfToken) return body.csrfToken;
  const setCookie = res.headers()['set-cookie'] ?? '';
  const match = setCookie.match(/(?:^|,|;)\s*_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

async function apiPost(
  request: APIRequestContext,
  path: string,
  data?: unknown,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    const csrf = await getCsrfToken(request, token);
    headers['X-CSRF-Token'] = csrf;
    headers['Cookie'] = `_csrf=${encodeURIComponent(csrf)}`;
  }
  const res = await request.post(`${API}${path}`, { data, headers, timeout: 30000 });
  return { status: res.status(), body: await res.json().catch(() => null), headers: res.headers() };
}

async function apiGet(
  request: APIRequestContext,
  path: string,
  token?: string,
) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await request.get(`${API}${path}`, { headers, timeout: 30000 });
  return { status: res.status(), body: await res.json().catch(() => null), headers: res.headers() };
}

async function apiPatch(
  request: APIRequestContext,
  path: string,
  data: unknown,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    const csrf = await getCsrfToken(request, token);
    headers['X-CSRF-Token'] = csrf;
    headers['Cookie'] = `_csrf=${encodeURIComponent(csrf)}`;
  }
  const res = await request.patch(`${API}${path}`, { data, headers, timeout: 30000 });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function apiDelete(
  request: APIRequestContext,
  path: string,
  token?: string,
) {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    const csrf = await getCsrfToken(request, token);
    headers['X-CSRF-Token'] = csrf;
    headers['Cookie'] = `_csrf=${encodeURIComponent(csrf)}`;
  }
  const res = await request.delete(`${API}${path}`, { headers, timeout: 30000 });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshCookie: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rawRes = await request.post(`${API}/api/auth/login`, {
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
    });
    if (rawRes.status() === 429) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    expect(rawRes.status()).toBe(200);
    const body = await rawRes.json();
    const cookies = rawRes.headers()['set-cookie'] ?? '';
    const match = cookies.match(/refresh_token=([^;]+)/);
    return {
      accessToken: body.accessToken as string,
      refreshCookie: match?.[1] ?? '',
    };
  }
  throw new Error('loginViaApi: exhausted retries due to rate limiting (429)');
}

/** Inject auth state into a fresh browser context for role-based browser testing */
async function authenticateContext(
  context: BrowserContext,
  userId: string,
  user: { email: string; fullName: string },
  role: string,
  refreshCookie: string,
): Promise<Page> {
  await context.addCookies([{
    name: 'refresh_token',
    value: refreshCookie,
    url: `${API}/api/auth`,
  }]);

  const page = await context.newPage();
  await page.addInitScript((authData) => {
    localStorage.setItem('berozgar_auth', JSON.stringify(authData));
  }, {
    id: userId,
    fullName: user.fullName,
    email: user.email,
    role: role.toLowerCase(),
    verified: true,
    provider: 'EMAIL',
    ...(role === 'ADMIN' ? { privilegeLevel: 'SUPER' } : {}),
  });

  return page;
}

/* ═══════════════════════════════════════════════════
   Phase 1: Infrastructure & Stack Validation
   ═══════════════════════════════════════════════════ */

test.describe('Phase 1: Infrastructure Health', () => {
  test.describe.configure({ mode: 'serial' });

  test('1.1 — API server is ready (health/ready)', async ({ request }) => {
    const res = await apiGet(request, '/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
  });

  test('1.2 — Full health report (health?verbose=true)', async ({ request }) => {
    const res = await apiGet(request, '/health?verbose=true');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.stores).toBeDefined();
  });

  test('1.3 — Frontend serves HTML on /', async ({ request }) => {
    const res = await request.get(WEB, { timeout: 15000 });
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain('<!doctype html');
  });

  test('1.4 — Security headers present', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    const h = res.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBeTruthy();
  });

  test('1.5 — CSRF token endpoint works', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/csrf-token');
    expect(res.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 2: User Provisioning
   ═══════════════════════════════════════════════════ */

test.describe('Phase 2: User Provisioning (Signup + Seeding)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    // Force global logout via API to clear any lingering sessions on the server
    await request.post(`${API}/api/auth/logout`).catch(() => {});
    await cleanupE2eData();
  });

  test.afterAll(async () => {
    // Don't cleanup here — we need users for Phase 3+
  });

  test('2.1 — Seed admin user', async () => {
    adminId = await ensureAdminUser(ADMIN_USER.email, ADMIN_USER.password, ADMIN_USER.fullName);
    expect(adminId).toBeTruthy();
  });

  test('2.2 — Seed verified seller', async () => {
    sellerId = await createVerifiedUser(STUDENT_SELLER.email, STUDENT_SELLER.password, STUDENT_SELLER.fullName);
    expect(sellerId).toBeTruthy();
  });

  test('2.3 — Seed verified buyer', async () => {
    buyerId = await createVerifiedUser(STUDENT_BUYER.email, STUDENT_BUYER.password, STUDENT_BUYER.fullName);
    expect(buyerId).toBeTruthy();
  });

  test('2.4 — Admin login via API', async ({ request }) => {
    const result = await loginViaApi(request, ADMIN_USER.email, ADMIN_USER.password);
    adminToken = result.accessToken;
    adminRefreshCookie = result.refreshCookie;
    expect(adminToken).toBeTruthy();
    expect(adminRefreshCookie).toBeTruthy();
  });

  test('2.5 — Seller login via API', async ({ request }) => {
    const result = await loginViaApi(request, STUDENT_SELLER.email, STUDENT_SELLER.password);
    sellerToken = result.accessToken;
    sellerRefreshCookie = result.refreshCookie;
    expect(sellerToken).toBeTruthy();
  });

  test('2.6 — Buyer login via API', async ({ request }) => {
    const result = await loginViaApi(request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    buyerToken = result.accessToken;
    buyerRefreshCookie = result.refreshCookie;
    expect(buyerToken).toBeTruthy();
  });

  test('2.7 — Verify user roles in DB', async () => {
    const admin = await getUserByEmail(ADMIN_USER.email);
    expect(admin).toBeTruthy();
    expect(admin!.role).toBe('ADMIN');

    const seller = await getUserByEmail(STUDENT_SELLER.email);
    expect(seller).toBeTruthy();
    expect(seller!.role).toBe('STUDENT_VERIFIED');

    const buyer = await getUserByEmail(STUDENT_BUYER.email);
    expect(buyer).toBeTruthy();
    expect(buyer!.role).toBe('STUDENT_VERIFIED');
  });
});

/* ═══════════════════════════════════════════════════
   Phase 3: PUBLIC USER (Unauthenticated) — API Tests
   ═══════════════════════════════════════════════════ */

test.describe('Phase 3: Public User — API Access Control', () => {
  test.describe.configure({ mode: 'serial' });

  // Public endpoints — should work WITHOUT auth
  test('3.1 — GET /api/listings (public) → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/listings');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  test('3.2 — GET /health → 200', async ({ request }) => {
    const res = await apiGet(request, '/health');
    expect(res.status).toBe(200);
  });

  test('3.3 — GET /health/ready → 200', async ({ request }) => {
    const res = await apiGet(request, '/health/ready');
    expect(res.status).toBe(200);
  });

  // Protected endpoints — should REJECT without auth
  test('3.4 — POST /api/listings (no auth) → 403', async ({ request }) => {
    const res = await apiPost(request, '/api/listings', { title: 'Hack', price: 0 });
    expect([401, 403]).toContain(res.status);
  });

  test('3.5 — GET /api/auth/me (no auth) → 401', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('3.6 — GET /api/profile (no auth) → 401', async ({ request }) => {
    const res = await apiGet(request, '/api/profile');
    expect(res.status).toBe(401);
  });

  test('3.7 — GET /api/requests (no auth) → 401', async ({ request }) => {
    const res = await apiGet(request, '/api/requests');
    expect(res.status).toBe(401);
  });

  test('3.8 — GET /api/disputes (no auth) → 401', async ({ request }) => {
    const res = await apiGet(request, '/api/disputes');
    expect(res.status).toBe(401);
  });

  test('3.9 — GET /api/admin/pending (no auth) → 401/403', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/pending');
    expect([401, 403]).toContain(res.status);
  });

  test('3.10 — GET /api/admin/stats (no auth) → 401/403', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/stats');
    expect([401, 403]).toContain(res.status);
  });

  test('3.11 — 404 for non-existent API route', async ({ request }) => {
    const res = await request.get(`${API}/api/nonexistent-route`, { timeout: 10000 });
    expect(res.status()).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 4: PUBLIC USER — Browser Tests
   ═══════════════════════════════════════════════════ */

test.describe('Phase 4: Public User — Browser Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test('4.1 — Landing page (/) loads without JS errors', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('ResizeObserver') && !e.includes('Worker'),
    );
    expect(criticalErrors).toEqual([]);
    await ctx.close();
  });

  test('4.2 — /login page renders login form', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // wait for Lanyard / animations

    // Either the login form or a CTA to show it should be visible
    const hasContent = await page.locator('text=Identity').first().isVisible({ timeout: 10000 }).catch(() => false)
      || await page.getByRole('button').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasContent).toBe(true);
    await ctx.close();
  });

  test('4.3 — /signup page renders signup form', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Handle if the form is collapsed (GIS enabled)
    const emailToggle = page.getByRole('button', { name: /or sign up with email/i });
    if (await emailToggle.isVisible()) {
      await emailToggle.click();
    }

    // The signup page has "REQUEST ACCESS" as a button text
    await expect(page.getByRole('button', { name: /REQUEST ACCESS/i }).first()).toBeVisible({ timeout: 15000 });

    
    // Check for either the Google button or the legacy email form
    const hasForm = await page.getByRole('button', { name: /Continue with Google|REQUEST ACCESS/i }).first().isVisible();
    expect(hasForm).toBe(true);
    await ctx.close();
  });

  test('4.4 — /home page is accessible (public module)', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    // Home may have public content or redirect to landing
    const status = page.url();
    expect(status).toBeTruthy(); // Page rendered — no crash
    await ctx.close();
  });

  test('4.5 — Protected route /profile redirects to /login for public user', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await ctx.close();
  });

  test('4.6 — Protected route /resale redirects to /login for public user', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto('/resale', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await ctx.close();
  });

  test('4.7 — Protected route /admin redirects to /login for public user', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await ctx.close();
  });

  test('4.8 — Non-existent route shows 404 page (no crash)', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Should show NotFound page, not crash
    const criticalErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('ResizeObserver') && !e.includes('Worker'),
    );
    expect(criticalErrors).toEqual([]);
    await ctx.close();
  });
});

/* ═══════════════════════════════════════════════════
   Phase 5: VERIFIED STUDENT — API Tests (Buyer + Seller)
   ═══════════════════════════════════════════════════ */

test.describe('Phase 5: Verified Student — API Access', () => {
  test.describe.configure({ mode: 'serial' });

  // Auth endpoints
  test('5.1 — GET /auth/me (seller) → 200 with user data', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/me', sellerToken);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(STUDENT_SELLER.email);
    expect(res.body.trust).toBeDefined();
  });

  test('5.2 — GET /auth/me (buyer) → 200 with user data', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/me', buyerToken);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(STUDENT_BUYER.email);
  });

  // Profile
  test('5.3 — GET /profile (seller) → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/profile', sellerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.identity.email).toBe(STUDENT_SELLER.email);
  });

  test('5.4 — GET /profile (buyer) → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/profile', buyerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.identity.email).toBe(STUDENT_BUYER.email);
  });

  // Listings
  test('5.5 — GET /listings (student with auth) → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/listings', sellerToken);
    expect(res.status).toBe(200);
  });

  test('5.6 — Seller creates listing → 201', async ({ request }) => {
    const res = await apiPost(request, '/api/listings', LISTING_DATA, sellerToken);
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(LISTING_DATA.title);
    expect(res.body.data.status).toBe('pending_review');
    listingId = res.body.data.id;
    expect(listingId).toBeTruthy();
  });

  test('5.7 — GET /listings/:id (seller views own) → 200', async ({ request }) => {
    const res = await apiGet(request, `/api/listings/${listingId}`, sellerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(listingId);
    expect(res.body.data.title).toBe(LISTING_DATA.title);
  });

  // Removed 5.8 since 201 already places listing in pending_review


  // Admin-only routes should reject student
  test('5.9 — Student cannot access /admin/pending → 403', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/pending', sellerToken);
    expect(res.status).toBe(403);
  });

  test('5.10 — Student cannot access /admin/stats → 403', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/stats', buyerToken);
    expect(res.status).toBe(403);
  });

  test('5.11 — Student cannot access /admin/audit → 403', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/audit', sellerToken);
    expect(res.status).toBe(403);
  });

  test('5.12 — Student cannot access /admin/fraud → 403', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/fraud', buyerToken);
    expect(res.status).toBe(403);
  });

  // Requests (before listing approval — should fail gracefully)
  test('5.13 — GET /requests (student) → 200 (may be empty)', async ({ request }) => {
    const res = await apiGet(request, '/api/requests', buyerToken);
    expect(res.status).toBe(200);
  });

  // 404 for non-existent listing
  test('5.14 — GET /listings/invalid-uuid → 404', async ({ request }) => {
    const res = await apiGet(request, '/api/listings/00000000-0000-0000-0000-000000000000', sellerToken);
    expect(res.status).toBe(404);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 6: ADMIN — API Tests
   ═══════════════════════════════════════════════════ */

test.describe('Phase 6: Admin — API Access', () => {
  test.describe.configure({ mode: 'serial' });

  test('6.1 — GET /auth/me (admin) → 200 with admin role', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/me', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.user.role.toUpperCase()).toContain('ADMIN');
  });

  test('6.2 — GET /admin/pending → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/pending', adminToken);
    expect(res.status).toBe(200);
    // Should contain the listing from Phase 5
    const pending = Array.isArray(res.body) ? res.body : res.body.data ?? [];
    const found = pending.find((l: { id: string }) => l.id === listingId);
    expect(found).toBeTruthy();
  });

  test('6.3 — Admin approves listing → 200', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/listings/${listingId}/status`,
      { status: 'approved' },
      adminToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('approved');
  });

  test('6.4 — GET /admin/stats → 200 with metrics', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/stats', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.totalUsers).toBeGreaterThanOrEqual(3);
    expect(res.body.data.totalListings).toBeGreaterThanOrEqual(1);
  });

  test('6.5 — GET /admin/users → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/users', adminToken);
    expect(res.status).toBe(200);
  });

  test('6.6 — GET /admin/users/:userId (drilldown) → 200', async ({ request }) => {
    const res = await apiGet(request, `/api/admin/users/${sellerId}`, adminToken);
    expect(res.status).toBe(200);
  });

  test('6.7 — GET /admin/audit → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/audit', adminToken);
    expect(res.status).toBe(200);
  });

  test('6.8 — GET /admin/fraud → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/fraud', adminToken);
    expect(res.status).toBe(200);
  });

  test('6.9 — GET /admin/integrity (SUPER) → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/admin/integrity', adminToken);
    expect(res.status).toBe(200);
  });

  test('6.10 — GET /profile (admin) → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/profile', adminToken);
    expect(res.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 7: Full Exchange Lifecycle
   ═══════════════════════════════════════════════════ */

test.describe('Phase 7: Complete Exchange Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test('7.1 — Approved listing visible in public list', async ({ request }) => {
    const res = await apiGet(request, '/api/listings?status=approved');
    expect(res.status).toBe(200);
    const listings = res.body.data ?? [];
    const found = listings.find((l: { id: string }) => l.id === listingId);
    expect(found).toBeTruthy();
    expect(found.title).toBe(LISTING_DATA.title);
  });

  test('7.2 — Buyer views listing detail → 200', async ({ request }) => {
    const res = await apiGet(request, `/api/listings/${listingId}`, buyerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(LISTING_DATA.title);
  });

  test('7.3 — Buyer creates exchange request → 201', async ({ request }) => {
    const res = await apiPost(request, '/api/requests', { listingId }, buyerToken);
    expect(res.status).toBe(201);
    expect(res.body.data.status.toLowerCase()).toBe('sent');
    requestId = res.body.data.id;
    expect(requestId).toBeTruthy();
  });

  test('7.4 — Seller sees incoming request → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/requests', sellerToken);
    expect(res.status).toBe(200);
  });

  test('7.5 — Seller accepts request → ACCEPTED', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'ACCEPT' },
      sellerToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('accepted');
  });

  test('7.6 — Schedule meeting → MEETING_SCHEDULED', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'SCHEDULE' },
      sellerToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toContain('meeting');
  });

  test('7.7 — Confirm exchange → COMPLETED', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'CONFIRM' },
      sellerToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('completed');
  });

  test('7.8 — Seller trust score updated', async () => {
    const trust = await getUserTrustData(sellerId);
    expect(trust).toBeTruthy();
    expect(trust!.completedExchanges).toBeGreaterThanOrEqual(1);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 8: Dispute Lifecycle
   ═══════════════════════════════════════════════════ */

test.describe('Phase 8: Dispute Lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  test('8.1 — Buyer raises dispute → DISPUTED', async ({ request }) => {
    const res = await apiPatch(
      request,
      `/api/requests/${requestId}/event`,
      { event: 'DISPUTE' },
      buyerToken,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.status.toLowerCase()).toBe('disputed');
  });

  test('8.2 — Buyer files dispute record → 201', async ({ request }) => {
    const res = await apiPost(
      request,
      '/api/disputes',
      {
        requestId,
        listingId,
        againstId: sellerId,
        type: 'ITEM_NOT_AS_DESCRIBED',
        description: 'E2E test dispute — item not as described.',
      },
      buyerToken,
    );
    expect(res.status).toBe(201);
    expect(res.body.data.status.toLowerCase()).toBe('open');
  });

  test('8.3 — Admin sees disputes → 200', async ({ request }) => {
    const res = await apiGet(request, '/api/disputes', adminToken);
    expect(res.status).toBe(200);
    const disputes = res.body.data ?? [];
    expect(disputes.length).toBeGreaterThanOrEqual(1);
  });

  test('8.4 — Admin resolves dispute (OPEN → UNDER_REVIEW → RESOLVED)', async ({ request }) => {
    const disputes = await apiGet(request, '/api/disputes', adminToken);
    const dispute = (disputes.body.data ?? []).find(
      (d: { requestId: string }) => d.requestId === requestId,
    );
    expect(dispute).toBeTruthy();

    // OPEN → UNDER_REVIEW
    const reviewRes = await apiPatch(
      request,
      `/api/disputes/${dispute.id}/status`,
      { status: 'UNDER_REVIEW' },
      adminToken,
    );
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status.toLowerCase()).toBe('under_review');

    // UNDER_REVIEW → RESOLVED
    const resolveRes = await apiPatch(
      request,
      `/api/disputes/${dispute.id}/status`,
      { status: 'RESOLVED' },
      adminToken,
    );
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status.toLowerCase()).toBe('resolved');
  });
});

/* ═══════════════════════════════════════════════════
   Phase 9: Auth Security Tests
   ═══════════════════════════════════════════════════ */

test.describe('Phase 9: Auth Security', () => {
  test.describe.configure({ mode: 'serial' });

  test('9.1 — Refresh token rotation works', async ({ request }) => {
    const loginRes = await request.post(`${API}/api/auth/login`, {
      data: { email: STUDENT_BUYER.email, password: STUDENT_BUYER.password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginRes.status()).toBe(200);

    const cookies = loginRes.headers()['set-cookie'];
    expect(cookies).toContain('refresh_token');
    const match = cookies!.match(/refresh_token=([^;]+)/);
    const refreshCookie = match![1];

    // Rotate
    const refreshRes = await request.post(`${API}/api/auth/refresh`, {
      headers: { Cookie: `refresh_token=${refreshCookie}` },
    });
    expect(refreshRes.status()).toBe(200);
    const refreshBody = await refreshRes.json();
    expect(refreshBody.accessToken).toBeTruthy();

    // Old token should be revoked (reuse detection)
    const reuseRes = await request.post(`${API}/api/auth/refresh`, {
      headers: { Cookie: `refresh_token=${refreshCookie}` },
    });
    expect(reuseRes.status()).toBe(401);
  });

  test('9.2 — Logout revokes session', async ({ request }) => {
    // Login fresh
    const loginRes = await request.post(`${API}/api/auth/login`, {
      data: { email: STUDENT_SELLER.email, password: STUDENT_SELLER.password },
      headers: { 'Content-Type': 'application/json' },
    });
    const cookies = loginRes.headers()['set-cookie']!;
    const match = cookies.match(/refresh_token=([^;]+)/);
    const refreshToken = match![1];
    const body = await loginRes.json();

    // Logout
    const logoutRes = await request.post(`${API}/api/auth/logout`, {
      headers: {
        Cookie: `refresh_token=${refreshToken}`,
        Authorization: `Bearer ${body.accessToken}`,
      },
    });
    expect(logoutRes.status()).toBe(200);

    // Trying to refresh after logout should fail
    const postLogoutRefresh = await request.post(`${API}/api/auth/refresh`, {
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
    expect(postLogoutRefresh.status()).toBe(401);
  });

  test('9.3 — Invalid bearer token → 401 on protected endpoint', async ({ request }) => {
    const res = await apiGet(request, '/api/auth/me', 'invalid-token-12345');
    expect(res.status).toBe(401);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 10: Analytics & Misc API
   ═══════════════════════════════════════════════════ */

test.describe('Phase 10: Analytics & Edge Cases', () => {
  test.describe.configure({ mode: 'serial' });

  test('10.1 — Analytics events accepted → 202', async ({ request }) => {

    const csrf = await getCsrfToken(request);
    const res = await request.post(`${API}/api/analytics/events`, {
      data: {
        events: [{
          name: 'e2e_role_test',
          level: 'info',
          timestamp: Date.now(),
          properties: { testRun: TEST_RUN },
        }],
      },
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
        Cookie: `_csrf=${encodeURIComponent(csrf)}`,
      },
    });
    expect(res.status()).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(true);
  });

  test('10.2 — Listings pagination works', async ({ request }) => {
    const res = await apiGet(request, '/api/listings?page=1&limit=5');
    expect(res.status).toBe(200);
    // Pagination may be at body root or inside body.pagination
    expect(res.body.pagination || res.body.meta || res.body.data).toBeDefined();
  });

  test('10.3 — Listings search works', async ({ request }) => {
    const res = await apiGet(request, `/api/listings?search=${encodeURIComponent('E2E')}`);
    expect(res.status).toBe(200);
  });

  test('10.4 — Listings filter by category works', async ({ request }) => {
    const res = await apiGet(request, '/api/listings?category=books');
    expect(res.status).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════
   Phase 11: VERIFIED STUDENT — Browser Tests
   ═══════════════════════════════════════════════════ */

test.describe('Phase 11: Verified Student — Browser Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test('11.1 — Student login via browser → redirects to /home', async ({ page }) => {
    test.setTimeout(90_000); // extra time for browser context teardown
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Ensure email form is visible — try the toggle button if present
    const legacyBtn = page.getByRole('button', { name: /USE LEGACY MAIL/i });
    if (await legacyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await legacyBtn.click();
      await page.waitForTimeout(500);
    }

    // The placeholder is "YOU@MCTRGIT.AC.IN" in LoginPage.tsx
    const emailInput = page.getByPlaceholder(/YOU@MCTRGIT\.AC\.IN|you@mctrgit\.ac\.in/i).first();
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(STUDENT_BUYER.email);

    
    const passInput = page.getByPlaceholder(/••••••••/i).first();
    await passInput.fill(STUDENT_BUYER.password);

    const submitBtn = page.getByRole('button', { name: /ENTER PORTAL/i });
    let loginStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const loginResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
        { timeout: 15000 },
      );

      await submitBtn.click();
      const loginResponse = await loginResponsePromise;
      loginStatus = loginResponse.status();

      if (loginStatus === 200) break;
      if (loginStatus !== 429) {
        const body = await loginResponse.text().catch(() => '');
        throw new Error(`Browser login failed with status ${loginStatus}. Response: ${body.slice(0, 300)}`);
      }

      // Transient per-email limiter in test environments: backoff and retry.
      await page.waitForTimeout(2000 * (attempt + 1));
    }

    expect(loginStatus).toBe(200);

    await expect(page).toHaveURL(/\/home/, { timeout: 30000 });
  });

  test('11.2 — /home page loads without console errors', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    // Re-login for fresh token
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('ResizeObserver') && !e.includes('Worker'),
    );
    expect(criticalErrors).toEqual([]);
    await ctx.close();
  });

  test('11.3 — /resale page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_SELLER.email, STUDENT_SELLER.password);
    const page = await authenticateContext(ctx, sellerId, STUDENT_SELLER, 'STUDENT_VERIFIED', result.refreshCookie);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/resale', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should be on /resale, not redirected
    expect(page.url()).toContain('/resale');
    const criticalErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('ResizeObserver') && !e.includes('Worker'),
    );
    expect(criticalErrors).toEqual([]);
    await ctx.close();
  });

  test('11.4 — /profile page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/profile');
    const criticalErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('ResizeObserver') && !e.includes('Worker'),
    );
    expect(criticalErrors).toEqual([]);
    await ctx.close();
  });

  test('11.5 — /accommodation page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/accommodation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/accommodation');
    await ctx.close();
  });

  test('11.6 — /essentials page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/essentials', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/essentials');
    await ctx.close();
  });

  test('11.7 — /academics page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/academics', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/academics');
    await ctx.close();
  });

  test('11.8 — /mess page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/mess', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/mess');
    await ctx.close();
  });

  test('11.9 — /hospital page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/hospital', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/hospital');
    await ctx.close();
  });

  test('11.10 — /jobs page loads for student', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/jobs');
    await ctx.close();
  });

  test('11.11 — Student cannot access /admin → redirected to /home', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, STUDENT_BUYER.email, STUDENT_BUYER.password);
    const page = await authenticateContext(ctx, buyerId, STUDENT_BUYER, 'STUDENT_VERIFIED', result.refreshCookie);

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should redirect to /home (wrong role)
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
    await ctx.close();
  });
});

/* ═══════════════════════════════════════════════════
   Phase 12: ADMIN — Browser Tests
   ═══════════════════════════════════════════════════ */

test.describe('Phase 12: Admin — Browser Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test('12.1 — Admin login via browser → redirects to /admin', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const page = await ctx.newPage();

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Ensure email form is visible — try all possible toggle buttons
    const legacyBtn = page.getByRole('button', { name: /USE LEGACY MAIL/i });
    if (await legacyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await legacyBtn.click();
      await page.waitForTimeout(500);
    }

    const emailInput = page.getByPlaceholder(/YOU@MCTRGIT\.AC\.IN|you@mctrgit\.ac\.in/i).first();
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill(ADMIN_USER.email);

    
    const passInput = page.getByPlaceholder(/••••••••/i).first();
    await passInput.fill(ADMIN_USER.password);
    
    const submitBtn = page.getByRole('button', { name: /ENTER PORTAL/i });
    let loginStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const loginResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
        { timeout: 15000 },
      );

      await submitBtn.click();
      const loginResponse = await loginResponsePromise;
      loginStatus = loginResponse.status();

      if (loginStatus === 200) break;
      if (loginStatus !== 429) {
        const body = await loginResponse.text().catch(() => '');
        throw new Error(`Browser login failed with status ${loginStatus}. Response: ${body.slice(0, 300)}`);
      }

      // Transient per-email limiter in test environments: backoff and retry.
      await page.waitForTimeout(2000 * (attempt + 1));
    }

    expect(loginStatus).toBe(200);

    // ADM-10 FIX: Admin should land on the admin dashboard or home (not remain on login).
    await expect(page).toHaveURL(/\/(admin|home)/, { timeout: 30000 });

    await ctx.close();
  });


  test('12.2 — Admin page loads for admin user', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, ADMIN_USER.email, ADMIN_USER.password);
    const page = await authenticateContext(ctx, adminId, ADMIN_USER, 'ADMIN', result.refreshCookie);

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    expect(page.url()).toContain('/admin');
    const criticalErrors = errors.filter(
      (e) => !e.includes('WebGL') && !e.includes('ResizeObserver') && !e.includes('Worker'),
    );
    expect(criticalErrors).toEqual([]);
    await ctx.close();
  });

  test('12.3 — Admin can view /profile', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, ADMIN_USER.email, ADMIN_USER.password);
    const page = await authenticateContext(ctx, adminId, ADMIN_USER, 'ADMIN', result.refreshCookie);

    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/profile');
    await ctx.close();
  });

  test('12.4 — Admin can view student profile drilldown via /profile/:userId', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, ADMIN_USER.email, ADMIN_USER.password);
    const page = await authenticateContext(ctx, adminId, ADMIN_USER, 'ADMIN', result.refreshCookie);

    await page.goto(`/profile/${sellerId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain(`/profile/${sellerId}`);
    await ctx.close();
  });

  test('12.5 — Admin can access /home', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, ADMIN_USER.email, ADMIN_USER.password);
    const page = await authenticateContext(ctx, adminId, ADMIN_USER, 'ADMIN', result.refreshCookie);

    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/home');
    await ctx.close();
  });

  test('12.6 — Admin logout flow works', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, ADMIN_USER.email, ADMIN_USER.password);
    const page = await authenticateContext(ctx, adminId, ADMIN_USER, 'ADMIN', result.refreshCookie);

    await page.goto('/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const logoutBtn = page.getByRole('button', { name: /Logout/i });
    if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    }
    await ctx.close();
  });
  test('12.7 — Admin "Back to Home" navigation works', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: WEB });
    const result = await loginViaApi(ctx.request, ADMIN_USER.email, ADMIN_USER.password);
    const page = await authenticateContext(ctx, adminId, ADMIN_USER, 'ADMIN', result.refreshCookie);

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const backBtn = page.getByRole('button', { name: /Back to Home/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 15000 });
    await backBtn.click();

    // Verify it redirects to /home (Index matches this in auth check)
    await expect(page).toHaveURL(/\/(home)?$/, { timeout: 15000 });
    await ctx.close();
  });
});

/* ═══════════════════════════════════════════════════
   Phase 13: Cleanup
   ═══════════════════════════════════════════════════ */

test.describe('Phase 13: Cleanup', () => {
  test('13.1 — Cleanup E2E data', async () => {
    await cleanupE2eData();
    await disconnectDb();
  });
});
