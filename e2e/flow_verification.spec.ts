import { test, expect, Page } from '@playwright/test';
import { createVerifiedUser, ensureAdminUser, cleanupE2eData, disconnectDb } from './helpers';

test.describe.configure({ mode: 'parallel' });

const BASE_URL = (process.env.E2E_WEB_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const TEST_RUN = Date.now();
const STUDENT_CREDENTIALS = { email: `e2e-flow-student-${TEST_RUN}@mctrgit.ac.in`, password: 'FlowPass@123' };
const ADMIN_CREDENTIALS = { email: `e2e-flow-admin-${TEST_RUN}@mctrgit.ac.in`, password: 'FlowPass@123' };

test.beforeAll(async () => {
  await createVerifiedUser(STUDENT_CREDENTIALS.email, STUDENT_CREDENTIALS.password, 'E2E Flow Student');
  await ensureAdminUser(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password, 'E2E Flow Admin');
});

test.afterAll(async () => {
  await cleanupE2eData();
  await disconnectDb();
});

async function safeScreenshot(page: Page, path: string) {
  try {
    await page.screenshot({ path, timeout: 3000 });
  } catch (err) {
    console.warn(`Screenshot skipped for ${path}:`, err instanceof Error ? err.message : String(err));
  }
}

async function ensureOnAdminPage(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/admin')) {
      return;
    }

    await page.waitForTimeout(1500);
  }

  throw new Error(`Failed to stay on /admin after retries, current URL: ${page.url()}`);
}

async function waitForListingRow(page: Page, listingName: string) {
  const searchInput = page.locator('input').first();
  await expect(searchInput).toBeVisible({ timeout: 15000 });

  await searchInput.fill(listingName);
  await searchInput.press('Enter');

  const row = page.locator(`tr:has-text("${listingName}")`).first();
  await expect(row).toBeVisible({ timeout: 30000 });

  return row;
}

// Helper function to login
async function login(page: Page, role: 'student' | 'admin') {
  const credentials = role === 'student' ? STUDENT_CREDENTIALS : ADMIN_CREDENTIALS;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    const legacyToggle = page.getByRole('button', { name: /USE LEGACY MAIL/i });
    if (await legacyToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await legacyToggle.click();
    }
    
    // Fill credentials
    const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"], [placeholder*="mctrgit" i], [placeholder*="email" i]');
    await emailInput.first().fill(credentials.email);
    
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[autocomplete="current-password"]');
    await passwordInput.first().fill(credentials.password);
    
    const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("ENTER PORTAL")');
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
      { timeout: 15000 },
    );
    await loginButton.first().click();
    const loginResponse = await loginResponsePromise;
    if (loginResponse.status() !== 200) {
      const body = await loginResponse.text().catch(() => '');
      throw new Error(`Login failed for ${role} with status ${loginResponse.status()}: ${body.slice(0, 250)}`);
    }
    
    await page.waitForURL(/\/(home|admin|profile)(\/|$)/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    const userRole = await page.evaluate(() => {
      try {
        const data = JSON.parse(localStorage.getItem('berozgar_auth') || '{}');
        return data.role || 'NOT_FOUND';
      } catch {
        return 'ERROR_PARSING';
      }
    });
    console.log(`ROLE AFTER LOGIN FOR ${role}:`, userRole);
    
    await safeScreenshot(page, `test-results/${role}-login-success.png`);
  } catch (error) {
    console.error(`Login failed for ${role}:`, error);
    await safeScreenshot(page, `test-results/${role}-login-error.png`);
    throw error;
  }
}

test.describe('Parallel Flows Verification', () => {

  test('Resale Upload Flow', async ({ browser }) => {
    test.setTimeout(180000);
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const timestamp = Date.now();
    const productName = `Test Product ${timestamp}`;
    
    await test.step('Student Login and Create Listing', async () => {
      await login(studentPage, 'student');
      
      try {
        await studentPage.goto(`${BASE_URL}/create-listing`);
        await studentPage.waitForLoadState('networkidle');
        
        // Select Resale Module
        await studentPage.getByRole('heading', { name: 'Resale Marketplace' }).click();

        // Fill Phase 1
        await studentPage.getByPlaceholder('What are you offering?').fill(productName);
        await studentPage.getByRole('combobox').click();
        await studentPage.locator('[role="option"]').nth(0).click(); // Select first category
        await studentPage.getByPlaceholder('0.00').fill('999');
        await studentPage.getByPlaceholder('Specify condition, edition, or technical specifications...').fill('This is a test product description for resale flow.');
        await studentPage.getByRole('button', { name: /NEXT PHASE/i }).click();

        // Fill Phase 2 (Media - skip image upload, just proceed if not strictly required or dummy it)
        await studentPage.getByRole('button', { name: /CONTINUE/i }).click();

        // Fill Phase 3 (Consent & Submit)
        await studentPage.getByRole('checkbox').click();
        await studentPage.getByRole('button', { name: /MANIFEST LISTING/i }).click();

          await studentPage.waitForTimeout(1200);
          await safeScreenshot(studentPage, `test-results/resale-student-submitted.png`);
      } catch (error) {
         console.error('Error in Student Resale flow:', error);
          await safeScreenshot(studentPage, `test-results/resale-student-error.png`);
         throw error;
      } finally {
        await studentPage.close();
      }
    });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await test.step('Admin Approval Check', async () => {
      await login(adminPage, 'admin');
      
      try {
        await ensureOnAdminPage(adminPage);
        await safeScreenshot(adminPage, `test-results/admin-page-resale.png`);
        console.log("Current Admin URL:", adminPage.url());

        // Search and approve listing
        const row = await waitForListingRow(adminPage, productName);

        const inspectBtn = row.locator('button').first();
        await expect(inspectBtn).toBeVisible({ timeout: 10000 });
        await inspectBtn.click();
        await adminPage.getByRole('button', { name: /Confirm & Manifest/i }).click();
        await adminPage.getByRole('button', { name: 'Approve Listing' }).click();
        console.log(`Product ${productName} approved successfully.`);
      } catch (error) {
        console.error('Error in Admin Resale flow:', error);
        await safeScreenshot(adminPage, `test-results/resale-admin-error.png`);
        throw error;
      } finally {
        await adminPage.close();
      }
    });
  });

  test('Academics Flow', async ({ browser }) => {
    test.setTimeout(180000);
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const timestamp = Date.now();
    const resourceName = `Test Academic Resource ${timestamp}`;
    
    await test.step('Student Login and Upload Academic Resource', async () => {
      await login(studentPage, 'student');
      
      try {
        await studentPage.goto(`${BASE_URL}/academics`);
        await studentPage.waitForLoadState('networkidle');

        // Click "Share a Resource"
        const addBtn = studentPage.getByRole('button', { name: /Share a Resource/i });
        await addBtn.click();
        
        // Fill Phase 1
        await studentPage.getByPlaceholder('What are you offering?').fill(resourceName);
        await studentPage.getByRole('combobox').click();
        await studentPage.locator('[role="option"]').nth(0).click(); // Select first category
        await studentPage.getByPlaceholder('0.00').fill('150');
        await studentPage.getByPlaceholder('Specify condition, edition, or technical specifications...').fill('This is a test academic resource description.');
        await studentPage.getByRole('button', { name: /NEXT PHASE/i }).click();

        // Phase 2
        await studentPage.getByRole('button', { name: /CONTINUE/i }).click();

        // Phase 3
        await studentPage.getByRole('checkbox').click();
        await studentPage.getByRole('button', { name: /MANIFEST LISTING/i }).click();

          await studentPage.waitForTimeout(1200);
      } catch (error) {
         console.error('Error in Student Academics flow:', error);
          await safeScreenshot(studentPage, `test-results/academics-student-error.png`);
         throw error;
      } finally {
        await studentPage.close();
      }
    });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await test.step('Admin Academics Approval Check', async () => {
      await login(adminPage, 'admin');
      
      try {
        await ensureOnAdminPage(adminPage);

        // Search and approve item
        const row = await waitForListingRow(adminPage, resourceName);

        const inspectBtn = row.locator('button').first();
        await expect(inspectBtn).toBeVisible({ timeout: 10000 });
        await inspectBtn.click();
        await adminPage.getByRole('button', { name: /Confirm & Manifest/i }).click();
        await adminPage.getByRole('button', { name: 'Approve Listing' }).click();
        console.log(`Academic Resource ${resourceName} approved successfully.`);
      } catch (error) {
        console.error('Error in Admin Academics flow:', error);
        await safeScreenshot(adminPage, `test-results/academics-admin-error.png`);
        throw error;
      } finally {
        await adminPage.close();
      }
    });
  });

});

