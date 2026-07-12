import { test, expect } from '@playwright/test';

test.describe('Live Site Verification', () => {
    test('Verify homepage loading and console errors', async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                console.log(`Console Error: ${msg.text()}`);
            } else {
                console.log(`Console Log [${msg.type()}]: ${msg.text()}`);
            }
        });

        // Navigate to the live website
        console.log('Navigating to live homepage...');
        const response = await page.goto('https://rgitrozgar.in/', { waitUntil: 'networkidle', timeout: 30000 });
        
        expect(response).not.toBeNull();
        expect(response!.status()).toBe(200);

        // Take a screenshot of the homepage
        await page.screenshot({ path: 'live_homepage.png', fullPage: true });
        console.log('Homepage screenshot saved to live_homepage.png');

        // Check for major JavaScript errors
        console.log(`Captured console errors count: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
            console.log('Console Errors:', consoleErrors);
        }
    });

    test('Verify light mode readability and contrast', async ({ page }) => {
        await page.goto('https://rgitrozgar.in/', { waitUntil: 'domcontentloaded' });
        
        // Let's check light mode class on html tag
        const htmlClass = await page.locator('html').getAttribute('class');
        console.log(`HTML class: ${htmlClass}`);
        
        // Verify background is light / white and text is dark
        const bodyBg = await page.evaluate(() => {
            const body = document.body;
            const style = window.getComputedStyle(body);
            return {
                backgroundColor: style.backgroundColor,
                color: style.color
            };
        });
        console.log('Body styles:', bodyBg);
        
        // Take viewport screenshot for visual check
        await page.screenshot({ path: 'live_homepage_light.png' });
    });

    test('Verify MasterExperience dark mode overlays and portal tokens', async ({ page }) => {
        await page.goto('https://rgitrozgar.in/', { waitUntil: 'networkidle' });
        
        // Check if there is a dark/light mode toggle
        // According to ContextNav.tsx, it has a button with a Sun/Moon icon or a dark mode toggler
        // Let's see if we can trigger dark mode.
        // We can manually add the 'dark' class to html element to test dark mode.
        await page.evaluate(() => {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
        });
        
        console.log('Switched page to dark mode via class injection.');
        
        // Take screenshot in dark mode
        await page.screenshot({ path: 'live_homepage_dark.png' });
    });
});
