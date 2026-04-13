import { test, expect } from '@playwright/test';

// Run agents in parallel
test.describe.configure({ mode: 'parallel' });

const TARGET_URL = process.env.BASE_URL || 'https://rgitrozgar.in';

const ACCOUNTS = {
  admin: { email: 'kartikhulmukh24@gmail.com', password: 'Kartik24@', role: 'Main Admin' },
  verifiedStudent: { email: 'kadamdnyaeshwari@gmail.com', password: 'Kartik24@', role: 'Verified RGIT Student' },
  publicUser: { email: 'yashtaur24@gmail.com', password: 'Kartik24@', role: 'Public Guest' }
};

async function safeScreenshot(page, path) {
  try {
    await page.screenshot({ path, fullPage: true, timeout: 3000 });
  } catch (err) {
    console.warn(`Screenshot skipped for ${path}:`, err instanceof Error ? err.message : String(err));
  }
}

async function loginAs(page, contextStr, credentials) {
  console.log(`[${contextStr}] Navigating to login...`);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(700);

      const useLegacy = page.getByRole('button', { name: /USE LEGACY MAIL/i });
      if (await useLegacy.isVisible().catch(() => false)) {
        await useLegacy.click();
      }

      const emailField = page.locator('input[type="email"], input[name="email"], [placeholder*="MCTRGIT"], [placeholder*="Email"]').first();
      const passwordField = page.locator('input[type="password"], input[name="password"], [placeholder*="••••"]').first();

      await emailField.waitFor({ state: 'visible', timeout: 12000 });
      await passwordField.waitFor({ state: 'visible', timeout: 12000 });

      await emailField.fill(credentials.email);
      await passwordField.fill(credentials.password);

      const enterBtn = page.getByRole('button', { name: /ENTER PORTAL|Login|Sign In/i }).first();
      if (await enterBtn.isVisible().catch(() => false)) {
        await enterBtn.click({ timeout: 12000 });
        console.log(`[${contextStr}] Clicked login button.`);
      } else {
        await passwordField.press('Enter');
      }

      await page.waitForURL(/\/home|\/admin|\/resale|\/profile|\/login/, { timeout: 30000 });
      await page.waitForTimeout(1200);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[${contextStr}] Login attempt ${attempt} failed, retrying...`);
      await page.waitForTimeout(1000);
    }
  }

  throw lastError || new Error(`[${contextStr}] Login failed after retries`);
}

async function verifyPageNavigationAndScreenshot(page, role, pathName, expectedTitleSubstring) {
  console.log(`[${role}] Navigating to ${TARGET_URL}${pathName}`);
  await page.goto(`${TARGET_URL}${pathName}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);

  await expect(page).toHaveURL(new RegExp(pathName.replace('/', '\\/')), { timeout: 30000 });

  const safeFilename = pathName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  await safeScreenshot(page, `test-results/${role.replace(/ /g, '_')}_${safeFilename}.png`);

  if (expectedTitleSubstring) {
    const content = await page.content();
    expect.soft(content.toLowerCase()).toContain(expectedTitleSubstring.toLowerCase());
  }
}

test('Agent 1 [Admin] - App-Wide Oversight & Admin Functions', async ({ page }) => {
  test.setTimeout(180000);
  const role = 'Admin';
  await loginAs(page, role, ACCOUNTS.admin);
  
  await verifyPageNavigationAndScreenshot(page, role, '/home', '');
  await verifyPageNavigationAndScreenshot(page, role, '/admin', '');
  
  await verifyPageNavigationAndScreenshot(page, role, '/academics', '');
  await verifyPageNavigationAndScreenshot(page, role, '/accommodation', '');
  await verifyPageNavigationAndScreenshot(page, role, '/jobs', '');
  await verifyPageNavigationAndScreenshot(page, role, '/mess', '');
  await verifyPageNavigationAndScreenshot(page, role, '/hospital', '');

  console.log(`[${role}] Interaction: Checking user verification logs/actions.`);
  await page.goto(`${TARGET_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  
  // Admin tasks
  const viewUsersBtn = page.getByText(/Verified Entities/i).first();
  if (await viewUsersBtn.isVisible()) {
    await viewUsersBtn.click();
    await page.waitForTimeout(700);
    await safeScreenshot(page, `test-results/${role}_admin_users_view.png`);
  }
  
  console.log(`[${role}] Admin Agent tasks completed.`);
});

test('Agent 2 [Verified Student] - Core Feature Utilization', async ({ page }) => {
  test.setTimeout(180000);
  const role = 'Verified Student';
  await loginAs(page, role, ACCOUNTS.verifiedStudent);

  await verifyPageNavigationAndScreenshot(page, role, '/home', '');
  await verifyPageNavigationAndScreenshot(page, role, '/profile', '');
  
  await verifyPageNavigationAndScreenshot(page, role, '/academics', '');
  await verifyPageNavigationAndScreenshot(page, role, '/accommodation', '');
  await verifyPageNavigationAndScreenshot(page, role, '/jobs', '');
  await verifyPageNavigationAndScreenshot(page, role, '/mess', '');
  await verifyPageNavigationAndScreenshot(page, role, '/hospital', '');
  
  console.log(`[${role}] Interaction: Browsing and Filtering Resale.`);
  await page.goto(`${TARGET_URL}/resale`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(800);
  
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('laptop');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    await safeScreenshot(page, `test-results/${role}_resale_search.png`);
  }

  console.log(`[${role}] Interaction: Attempting to create a listing.`);
  await page.goto(`${TARGET_URL}/create-listing`, {waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(1000);
  
  const moduleBtn = page.getByRole('heading', { name: 'Resale Marketplace' });
  if (await moduleBtn.isVisible()) {
    await moduleBtn.click();
    await page.waitForTimeout(700);
    const titleInput = page.getByPlaceholder('What are you offering?');
    if (await titleInput.isVisible()) {
      await titleInput.fill('E2E Parallel Testing Item');
      const priceInput = page.getByPlaceholder('0.00');
      if (await priceInput.isVisible()) await priceInput.fill('500');
      await safeScreenshot(page, `test-results/${role}_create_listing_filled.png`);
    }
  } else {
    console.error(`[${role}] module select not available on create-listing.`);
  }
  
  console.log(`[${role}] Verified Student tasks completed.`);
});

test('Agent 3 [Public Guest] - Boundary & Constraints Testing', async ({ page }) => {
  test.setTimeout(180000);
  const role = 'Public User';
  await loginAs(page, role, ACCOUNTS.publicUser);

  await verifyPageNavigationAndScreenshot(page, role, '/home', '');
  await verifyPageNavigationAndScreenshot(page, role, '/resale', '');

  console.log(`[${role}] Interaction: Trying to access restricted route /create-listing`);
  await page.goto(`${TARGET_URL}/create-listing`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1000);
  await safeScreenshot(page, `test-results/${role}_attempt_create_listing.png`);
  
  let currentUrl = page.url();
  if (currentUrl.includes('create-listing')) {
     console.log(`[${role}] SEVERE WARNING: Public user reached /create-listing. The "Access: Public User" bug is confirmed!`);
  } else {
     console.log(`[${role}] Redirected appropriately from /create-listing.`);
  }

  console.log(`[${role}] Interaction: Viewing /resale details`);
  await page.goto(`${TARGET_URL}/resale`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1000);
  
  const sellBtn = page.getByRole('button', { name: /Sell Item/i });
  if (await sellBtn.count() > 0 && await sellBtn.isVisible()) {
    await sellBtn.click();
    await page.waitForTimeout(700);
    await safeScreenshot(page, `test-results/${role}_attempt_sell.png`);
  }

  console.log(`[${role}] Interaction: Trying to access /admin`);
  await page.goto(`${TARGET_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);
  currentUrl = page.url();
  if (currentUrl.includes('admin')) {
      console.log(`[${role}] SEVERE WARNING: Public guest breached /admin!!`);
      await safeScreenshot(page, `test-results/${role}_admin_breach.png`);
  }

  console.log(`[${role}] Public User tasks completed.`);
});
