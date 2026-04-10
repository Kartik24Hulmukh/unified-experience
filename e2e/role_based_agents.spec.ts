import { test, expect } from '@playwright/test';

// Run tests in parallel to simulate simultaneous agent usage
test.describe.configure({ mode: 'parallel' });

const TARGET_URL = process.env.BASE_URL || 'https://rgitrozgar.in';

const ACCOUNTS = {
  admin: { email: 'kartikhulmukh24@gmail.com', password: 'Kartik24@' },
  verifiedStudent: { email: 'kadamdnyaeshwari@gmail.com', password: 'Kartik24@' },
  publicUser: { email: 'yashtaur24@gmail.com', password: 'Kartik24@' }
};

// Helper function to handle aggressive login flow
async function loginAs(page, role, credentials) {
  console.log(`[${role}] Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  // Wait to see if we are stuck on "Loading..."
  try {
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 15000 });
  } catch (e) {
    console.warn(`[${role}] Warning: "Loading..." screen persisted for a long time. The site might be blocked by API timeouts.`);
  }

  // Attempt to find login button or navigate to /login explicitly
  console.log(`[${role}] Navigating to login...`);
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'domcontentloaded' });

  // Wait for login form to appear
  try {
    await page.fill('input[type="email"], input[name="email"], [placeholder*="Email"]', credentials.email);
    await page.fill('input[type="password"], input[name="password"], [placeholder*="Password"]', credentials.password);
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    console.log(`[${role}] Submitted login credentials.`);
    
    // Wait for redirect to dashboard or home
    await page.waitForNavigation({ timeout: 10000 }).catch(() => console.log(`[${role}] No explicit navigation observed post-login.`));
  } catch (e) {
    console.error(`[${role}] Login form interaction failed. The app might be locked or unrendered.`);
  }
}

// 1. ADMIN AGENT TEST
test('Agent 1 [Admin] - Aggressive System Testing', async ({ page }) => {
  await loginAs(page, 'Admin', ACCOUNTS.admin);
  
  console.log('[Admin] Testing admin dashboard access...');
  await page.goto(`${TARGET_URL}/admin`, { timeout: 10000 }).catch(() => {});
  
  // Looking for approval buttons, settings, user management
  const adminElements = await page.locator('text=Approve, text=Manage, text=Settings').count();
  console.log(`[Admin] Found ${adminElements} admin-specific action buttons.`);
  
  // Try taking a snapshot of the final state
  await page.screenshot({ path: 'test-results/admin-flow.png' });
});

// 2. VERIFIED STUDENT AGENT TEST
test('Agent 2 [Verified Student] - Feature Testing', async ({ page }) => {
  await loginAs(page, 'Verified Student', ACCOUNTS.verifiedStudent);
  
  console.log('[Verified Student] Testing student dashboard and features...');
  await page.goto(`${TARGET_URL}/dashboard`, { timeout: 10000 }).catch(() => {});
  await page.goto(`${TARGET_URL}/jobs`, { timeout: 10000 }).catch(() => {});
  await page.goto(`${TARGET_URL}/community`, { timeout: 10000 }).catch(() => {});
  
  // Try taking a snapshot of the final state
  await page.screenshot({ path: 'test-results/student-flow.png' });
});

// 3. PUBLIC USER AGENT TEST
test('Agent 3 [Public User] - Onboarding & Basic Access Testing', async ({ page }) => {
  await loginAs(page, 'Public User', ACCOUNTS.publicUser);
  
  console.log('[Public User] Testing limited access boundaries...');
  await page.goto(`${TARGET_URL}/profile`, { timeout: 10000 }).catch(() => {});
  
  // They shouldn't be able to access verified things
  await page.goto(`${TARGET_URL}/premium-content`, { timeout: 5000 }).catch(() => {});
  
  // Try taking a snapshot of the final state
  await page.screenshot({ path: 'test-results/public-flow.png' });
});
