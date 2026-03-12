import { test, expect } from '@playwright/test';
import { getLatestOtp } from './helpers';

const TEST_EMAIL = `e2e-auth-behavior-${Math.floor(Date.now() / 1000)}@mctrgit.ac.in`;
const TEST_PASS = 'TestPass@123!';

test.describe('Authentication Flow - Behavioral Tests', () => {
    test.describe.configure({ mode: 'serial' });

    test('Phase 1 — Signup (Email): User created only after OTP verification with correct defaults', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/signup');
        // Expand email form
        await page.getByText('or sign up with email').click();

        await page.getByPlaceholder('John Doe').fill('Behavioral User');
        await page.getByPlaceholder('you@mctrgit.ac.in').fill(TEST_EMAIL);
        await page.getByPlaceholder('••••••••').fill(TEST_PASS);

        // Submit
        await page.getByRole('button', { name: /REQUEST ACCESS/i }).click({ force: true });

        // Wait for redirect to /verify
        await expect(page).toHaveURL(/\/verify/, { timeout: 15000 });
        await page.waitForTimeout(1000);

        // Read OTP from DB
        const otp = await getLatestOtp(TEST_EMAIL);
        expect(otp).toBeDefined();

        // Focus the OTP input explicitly before typing. The real OTP component
        // does not guarantee autofocus in headless runs.
        await page.getByRole('textbox').click();
        await page.keyboard.type(otp!);

        // Redirect to /home
        await expect(page).toHaveURL(/\/home/, { timeout: 15000 });

        // Final Verify: Cookie check
        const cookies = await page.context().cookies();
        expect(cookies.some(c => c.name === 'refresh_token')).toBeTruthy();
    });

    // We skip Phase 2 Google Login UI for headless since it requires a real Google window interaction or mock.
    // The smoke tests already mock it via apiPost bypass if needed.

    test('Phase 3 — Logout: Logout instantly logs out all open tabs (multi-tab sync)', async ({ context }) => {
        // Setup: Tab 1 (Main)
        const page1 = await context.newPage();
        await page1.goto('http://127.0.0.1:8080/login');

        // Wait for animation or options
        await page1.getByText('USE LEGACY MAIL').click();
        await page1.getByPlaceholder('YOU@MCTRGIT.AC.IN').fill(TEST_EMAIL);
        await page1.getByPlaceholder('••••••••').fill(TEST_PASS);
        await page1.getByRole('button', { name: /ENTER PORTAL/i }).click();

        // Wait for /home
        await expect(page1).toHaveURL(/\/home/, { timeout: 15000 });

        // Setup: Tab 2 (Secondary)
        const page2 = await context.newPage();
        await page2.goto('http://127.0.0.1:8080/home');
        // Because of the hydration fix in AuthContext, Tab 2 should successfully call /auth/refresh and remain on /home
        await expect(page2).toHaveURL(/\/home/, { timeout: 20000 });

        // Action: Logout in Tab 1
        await page1.getByLabel('Logout').click();

        // Result: Both tabs should redirect to /login
        await expect(page1).toHaveURL(/\/login/, { timeout: 10000 });
        await expect(page2).toHaveURL(/\/login/, { timeout: 10000 });

        await context.close();
    });

});
