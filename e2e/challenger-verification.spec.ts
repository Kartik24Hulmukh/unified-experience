import { test, expect } from '@playwright/test';

test.describe('Challenger 2 — Adversarial verification of website fixes', () => {

  test('1. Verify offline banner behavior (adds banner when offline, removes when online)', async ({ page, context }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Set network to offline
    await context.setOffline(true);
    
    // Verify offline banner appears
    const offlineBanner = page.locator('div.bg-yellow-500:has-text("You\'re offline.")');
    await expect(offlineBanner).toBeVisible();
    
    // Set network back to online
    await context.setOffline(false);
    
    // Verify offline banner disappears
    await expect(offlineBanner).not.toBeVisible();
  });

  test('2. Verify login form submission error focus', async ({ page }) => {
    // Go to login page
    await page.goto('/login');
    
    // Make sure form is ready
    await expect(page.locator('input#email')).toBeVisible();
    
    // Click submit button without filling fields
    await page.locator('[data-testid="login-submit"]').click();
    
    // Verify email input gets focused (first invalid field)
    const emailInput = page.locator('input#email');
    await expect(emailInput).toBeFocused();
  });

  test('3. Verify signup form submission error focus', async ({ page }) => {
    // Go to signup page
    await page.goto('/signup');
    
    // Expand email sign up form if it is collapsed
    const signupBtn = page.locator('button:has-text("or sign up with email")');
    if (await signupBtn.isVisible()) {
      await signupBtn.click();
    }
    
    // Click submit button
    const submitBtn = page.locator('button[type="submit"]:has-text("Request Account"), button[type="submit"]:has-text("REGISTER"), [data-testid="signup-submit"]');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    
    // Verify full name input gets focused (first invalid field in signup)
    const fullNameInput = page.locator('input#fullName');
    await expect(fullNameInput).toBeFocused();
  });

  test('4a. Verify listings counter when database is empty (displays "Contact for pricing")', async ({ page, context }) => {
    const mockUser = {
      id: "test-user-id",
      fullName: "Test User",
      email: "test@mctrgit.ac.in",
      role: "student_verified",
      verified: true,
      provider: "email"
    };

    // Set local storage session data
    await page.addInitScript((user) => {
      window.localStorage.setItem('berozgar_auth', JSON.stringify(user));
    }, mockUser);

    // Setup routes to mock auth and listings
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: mockUser,
          trust: { status: "GOOD_STANDING", reasons: [] },
          restriction: { isRestricted: false, blockedActions: [], reasons: [] }
        })
      });
    });

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accessToken: "mock-access-token"
        })
      });
    });

    // Intercept listings API and return empty data
    await page.route('**/api/listings*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
          meta: { total: 0 }
        })
      });
    });
    
    // Go to accommodation page
    await page.goto('/accommodation');
    
    // Verify that Rent Range shows "Contact for pricing"
    await expect(page.locator('text=Contact for pricing')).toBeVisible();
  });

  test('4b. Verify listings counter when database is populated (displays rent range)', async ({ page, context }) => {
    const mockUser = {
      id: "test-user-id",
      fullName: "Test User",
      email: "test@mctrgit.ac.in",
      role: "student_verified",
      verified: true,
      provider: "email"
    };

    // Set local storage session data
    await page.addInitScript((user) => {
      window.localStorage.setItem('berozgar_auth', JSON.stringify(user));
    }, mockUser);

    // Setup routes to mock auth and listings
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: mockUser,
          trust: { status: "GOOD_STANDING", reasons: [] },
          restriction: { isRestricted: false, blockedActions: [], reasons: [] }
        })
      });
    });

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accessToken: "mock-access-token"
        })
      });
    });

    // Intercept listings API and return populated listings
    await page.route('**/api/listings*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: '1', title: 'Flats 1', price: 5000, status: 'APPROVED', module: 'ACCOMMODATION' },
            { id: '2', title: 'Flats 2', price: 15000, status: 'APPROVED', module: 'ACCOMMODATION' }
          ],
          meta: { total: 2 }
        })
      });
    });
    
    // Go to accommodation page
    await page.goto('/accommodation');
    
    // Verify that Rent Range shows the correct formatted price range: "₹5,000 – ₹15,000 / mo"
    await expect(page.locator('text=₹5,000 – ₹15,000 / mo')).toBeVisible();
  });
});
