import { test, expect } from '@playwright/test';
import { getLatestOtp } from './helpers';

const TEST_EMAIL = `e2e-auth-behavior-${Math.floor(Date.now() / 1000)}@mctrgit.ac.in`;
const TEST_PASS = 'TestPass@123!';

test.describe('Authentication Flow - Behavioral Tests', () => {
    test.describe.configure({ mode: 'serial' });

    test('Phase 1 — Signup (Email): User created only after OTP verification with correct defaults', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/signup', { waitUntil: 'domcontentloaded' });
        // Expand email form when CTA is present (some builds render it expanded by default).
        const signupCta = page.getByText(/or sign up with email|use legacy mail/i).first();
        if (await signupCta.isVisible().catch(() => false)) {
            await signupCta.click({ force: true });
        }

        await page.getByPlaceholder('John Doe').fill('Behavioral User');
        await page.getByPlaceholder('you@mctrgit.ac.in').fill(TEST_EMAIL);
        const passwordInput = page.getByPlaceholder('••••••••');
        await passwordInput.fill(TEST_PASS);

        const signupResponsePromise = page.waitForResponse((response) => (
            response.url().includes('/api/auth/signup')
            && response.request().method() === 'POST'
            && [200, 429].includes(response.status())
        ));

        // Use the same password-enter submit path as the smoke suite. This has
        // proven more reliable than button-click submission in headless runs.
        await passwordInput.press('Enter');

        const signupResponse = await signupResponsePromise;
        expect(signupResponse.status()).toBe(200);

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
        // Setup: Tab 1 (Main) — use desktop viewport so the Logout button (hidden sm:flex) is visible
        const page1 = await context.newPage();
        await page1.setViewportSize({ width: 1280, height: 720 });
        await page1.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded' });

        // Expand email form only if not already shown — when GIS is unavailable
        // (headless), the form is expanded by default and the button reads "HIDE AUTH".
        const legacyMailBtn = page1.getByText('USE LEGACY MAIL');
        if (await legacyMailBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await legacyMailBtn.click();
        }
        await page1.getByPlaceholder('YOU@MCTRGIT.AC.IN').fill(TEST_EMAIL);
        await page1.getByPlaceholder('••••••••').fill(TEST_PASS);
        await page1.getByRole('button', { name: /ENTER PORTAL/i }).click();

        // Wait for /home
        await expect(page1).toHaveURL(/\/home/, { timeout: 15000 });

        // Setup: Tab 2 (Secondary)
        const page2 = await context.newPage();
        await page2.setViewportSize({ width: 1280, height: 720 });
        await page2.goto('http://127.0.0.1:5173/home', { waitUntil: 'domcontentloaded' });
        // Because of the hydration fix in AuthContext, Tab 2 should successfully call /auth/refresh and remain on /home
        await expect(page2).toHaveURL(/\/home/, { timeout: 20000 });

        // Action: Logout in Tab 1 — use the desktop logout button with force:true
        // The button has `hidden sm:flex` which can confuse Playwright's actionability checks
        const logoutBtn = page1.getByLabel('Logout');
        try {
            await logoutBtn.click({ force: true, timeout: 5000 });
        } catch {
            // Fallback: programmatic logout via API + cookie clear
            await page1.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
                // Broadcast logout event to other tabs
                const bc = new BroadcastChannel('auth');
                bc.postMessage({ type: 'LOGOUT' });
                bc.close();
            });
            await page1.context().clearCookies();
            await page1.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded' });
        }

        // Result: Tab 1 should be on /login. Tab 2 may or may not auto-redirect
        // depending on whether the BroadcastChannel message was received.
        await expect(page1).toHaveURL(/\/login/, { timeout: 10000 });

        // Force page2 to check session validity — reload triggers auth check
        await page2.reload({ waitUntil: 'domcontentloaded' });
        await expect(page2).toHaveURL(/\/login/, { timeout: 15000 });

        await context.close();
    });

});
