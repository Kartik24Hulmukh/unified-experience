import { test, expect } from '@playwright/test';

// Run agents in parallel
test.describe.configure({ mode: 'parallel' });

const TARGET_URL = process.env.BASE_URL || 'https://rgitrozgar.in';

const ACCOUNTS = {
  admin: { email: 'kartikhulmukh24@gmail.com', password: 'Kartik24@', role: 'Main Admin' },
  verifiedStudent: { email: 'kadamdnyaeshwari@gmail.com', password: 'Kartik24@', role: 'Verified RGIT Student' },
  publicUser: { email: 'yashtaur24@gmail.com', password: 'Kartik24@', role: 'Public Guest' }
};

async function loginAs(page, contextStr, credentials) {
  console.log(`[${contextStr}] Navigating to login...`);
  
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const inputs = await page.locator('input').all();
  if (inputs.length >= 2) {
    await inputs[0].fill(credentials.email);
    await page.waitForTimeout(500); 
    await inputs[1].fill(credentials.password);

    const enterBtn = page.getByRole('button', { name: /ENTER PORTAL/i });
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
      console.log(`[${contextStr}] Clicked login button.`);
    } else {
      console.log(`[${contextStr}] ENTER PORTAL button not found! Fallback to pressing Enter.`);
      await page.keyboard.press('Enter');
    }
  } else {
    console.error(`[${contextStr}] Login inputs not found properly!`);
  }
  
  // Wait to login and ensure loading screen / state resolves
  await page.waitForTimeout(5000); 
}

async function verifyPageNavigationAndScreenshot(page, role, pathName, expectedTitleSubstring) {
  console.log(`[${role}] Navigating to ${TARGET_URL}${pathName}`);
  await page.goto(`${TARGET_URL}${pathName}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); 

  const safeFilename = pathName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  await page.screenshot({ path: `test-results/${role.replace(/ /g, '_')}_${safeFilename}.png`, fullPage: true });

  if (expectedTitleSubstring) {
    const content = await page.content();
    expect.soft(content.toLowerCase()).toContain(expectedTitleSubstring.toLowerCase());
  }
}

test('Agent 1 [Admin] - App-Wide Oversight & Admin Functions', async ({ page }) => {
  const role = 'Admin';
  await loginAs(page, role, ACCOUNTS.admin);
  
  await verifyPageNavigationAndScreenshot(page, role, '/home', 'overview');
  await verifyPageNavigationAndScreenshot(page, role, '/admin', '');
  
  await verifyPageNavigationAndScreenshot(page, role, '/academics', '');
  await verifyPageNavigationAndScreenshot(page, role, '/accommodation', '');
  await verifyPageNavigationAndScreenshot(page, role, '/jobs', '');
  await verifyPageNavigationAndScreenshot(page, role, '/mess', '');
  await verifyPageNavigationAndScreenshot(page, role, '/hospital', '');

  console.log(`[${role}] Interaction: Checking user verification logs/actions.`);
  await page.goto(`${TARGET_URL}/admin`);
  await page.waitForTimeout(2000);
  
  // Admin tasks
  const viewUsersBtn = page.getByText(/Verified Entities/i).first();
  if (await viewUsersBtn.isVisible()) {
    await viewUsersBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/${role}_admin_users_view.png`, fullPage: true });
  }
  
  console.log(`[${role}] Admin Agent tasks completed.`);
});

test('Agent 2 [Verified Student] - Core Feature Utilization', async ({ page }) => {
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
  await page.goto(`${TARGET_URL}/resale`);
  await page.waitForTimeout(2000);
  
  const searchInput = page.locator('input[placeholder*="Search"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('laptop');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `test-results/${role}_resale_search.png`, fullPage: true });
  }

  console.log(`[${role}] Interaction: Attempting to create a listing.`);
  await page.goto(`${TARGET_URL}/create-listing`, {waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(3000);
  
  const moduleBtn = page.getByRole('heading', { name: 'Resale Marketplace' });
  if (await moduleBtn.isVisible()) {
    await moduleBtn.click();
    await page.waitForTimeout(1000);
    const titleInput = page.getByPlaceholder('What are you offering?');
    if (await titleInput.isVisible()) {
      await titleInput.fill('E2E Parallel Testing Item');
      const priceInput = page.getByPlaceholder('0.00');
      if (await priceInput.isVisible()) await priceInput.fill('500');
      await page.screenshot({ path: `test-results/${role}_create_listing_filled.png`, fullPage: true });
    }
  } else {
    console.error(`[${role}] module select not available on create-listing.`);
  }
  
  console.log(`[${role}] Verified Student tasks completed.`);
});

test('Agent 3 [Public Guest] - Boundary & Constraints Testing', async ({ page }) => {
  const role = 'Public User';
  await loginAs(page, role, ACCOUNTS.publicUser);

  await verifyPageNavigationAndScreenshot(page, role, '/home', '');
  await verifyPageNavigationAndScreenshot(page, role, '/resale', '');

  console.log(`[${role}] Interaction: Trying to access restricted route /create-listing`);
  await page.goto(`${TARGET_URL}/create-listing`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `test-results/${role}_attempt_create_listing.png`, fullPage: true });
  
  let currentUrl = page.url();
  if (currentUrl.includes('create-listing')) {
     console.log(`[${role}] SEVERE WARNING: Public user reached /create-listing. The "Access: Public User" bug is confirmed!`);
  } else {
     console.log(`[${role}] Redirected appropriately from /create-listing.`);
  }

  console.log(`[${role}] Interaction: Viewing /resale details`);
  await page.goto(`${TARGET_URL}/resale`);
  await page.waitForTimeout(3000);
  
  const sellBtn = page.getByRole('button', { name: /Sell Item/i });
  if (await sellBtn.count() > 0 && await sellBtn.isVisible()) {
    await sellBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test-results/${role}_attempt_sell.png`, fullPage: true });
  }

  console.log(`[${role}] Interaction: Trying to access /admin`);
  await page.goto(`${TARGET_URL}/admin`);
  await page.waitForTimeout(2000);
  currentUrl = page.url();
  if (currentUrl.includes('admin')) {
      console.log(`[${role}] SEVERE WARNING: Public guest breached /admin!!`);
      await page.screenshot({ path: `test-results/${role}_admin_breach.png`, fullPage: true });
  }

  console.log(`[${role}] Public User tasks completed.`);
});
