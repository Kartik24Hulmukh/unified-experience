import { test, expect } from '@playwright/test';

const BASE_URL = 'https://rgitrozgar.in';
const ADMIN_CREDENTIALS = {
  email: 'kartikhulmukh24@gmail.com',
  password: 'Kartik24@',
};

test('admin can stay on /admin after login', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  const emailInput = page.locator('input[type="email"], input[name="email"], [placeholder*="Email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"], [placeholder*="Password"]');
  const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), button:has-text("ENTER PORTAL")');

  await emailInput.first().fill(ADMIN_CREDENTIALS.email);
  await passwordInput.first().fill(ADMIN_CREDENTIALS.password);
  await loginButton.first().click();

  await page.waitForLoadState('networkidle');
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });

  const finalUrl = page.url();
  const roleFromStorage = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('berozgar_auth');
      return raw ? JSON.parse(raw).role : 'MISSING';
    } catch {
      return 'PARSE_ERROR';
    }
  });

  console.log('ADMIN_SMOKE_ROLE', roleFromStorage);
  console.log('ADMIN_SMOKE_URL', finalUrl);

  await expect(page).toHaveURL(/\/admin/);
});
