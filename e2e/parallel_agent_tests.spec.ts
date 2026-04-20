import { test, expect } from '@playwright/test';

const BASE_URL = (process.env.E2E_WEB_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');

test.describe('Parallel Agent Tests for Unified-Experience', () => {

  test('Agent 1: Landing Page load and Title assertions', async ({ page }) => {
    console.log('Agent 1: Navigating to landing page...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    // Assert title is present
    const title = await page.title();
    console.log(`Agent 1: Page title is "${title}"`);
    expect(title.length).toBeGreaterThan(0);
    
    // Quick sanity check for body
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Agent 2: Navigation and Login Flow', async ({ page }) => {
    console.log('Agent 2: Starting Login flow...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    // Find Login link/button
    const loginButton = page.locator('text=/log in|login|sign in|sign-in/i').first();
    if (await loginButton.isVisible()) {
      console.log('Agent 2: Found login button, clicking it.');
      await loginButton.click();
      
      // Look for standard login fields
      const emailInput = page.locator('input[type="email"], input[name*="email"], input[name*="user"]').first();
      const passInput = page.locator('input[type="password"], input[name*="pass"]').first();
      
      if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill('testagent_login@example.com');
        if (await passInput.isVisible()) {
          await passInput.fill('DummyPassword123!');
        }
        
        const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
        }
      }
    } else {
      console.log('Agent 2: No obvious login button found on the landing page.');
    }
  });

  test('Agent 3: Registration / Sign Up Flow', async ({ page }) => {
    console.log('Agent 3: Starting Registration flow...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    const registerButton = page.locator('text=/register|sign up|signup/i').first();
    if (await registerButton.isVisible()) {
      console.log('Agent 3: Found registration button, clicking it.');
      await registerButton.click();
      
      // Fill out dummy signup email
      const emailInput = page.locator('input[type="email"], input[name*="email"]').first();
      if (await emailInput.isVisible({ timeout: 5000 })) {
          await emailInput.fill('newagent_signup@example.com');
      }
    } else {
      console.log('Agent 3: No obvious registration button found on the landing page.');
    }
  });

  test('Agent 4: Navigation to Secondary Pages (About/Contact/Courses)', async ({ page }) => {
    console.log('Agent 4: Exploring secondary routes...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    const navLinks = page.locator('a').filter({ hasText: /about|contact|courses|jobs|companies/i });
    if (await navLinks.count() > 0) {
      console.log('Agent 4: Clicking a secondary navigation link.');
      await navLinks.first().click();
      await page.waitForLoadState('domcontentloaded');
      console.log('Agent 4: Successfully navigated to ' + page.url());
    }
  });

  test('Agent 5: Dashboard / Main App Engagement (Scroll & UI interacting)', async ({ page }) => {
    console.log('Agent 5: Simulating user scrolling and interaction...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Simulate user scroll
    console.log('Agent 5: Scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);
    
    console.log('Agent 5: Scrolling up...');
    await page.evaluate(() => window.scrollBy(0, -1000));
    
    // Look for any interactive elements (like a search bar)
    const searchBar = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchBar.isVisible()) {
      console.log('Agent 5: Found search bar, entering text.');
      await searchBar.fill('Software Engineer');
      await searchBar.press('Enter');
      await page.waitForTimeout(2000);
    }
  });
});