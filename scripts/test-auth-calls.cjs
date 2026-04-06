const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kadam\\.gemini\\antigravity\\brain\\ae20aacc-b3d8-4210-b9d0-ad28e8d95e11';
const BASE_URL = 'http://localhost:8080';
const LISTING_ID = 'cf253860-995f-462e-a7e8-bb97aa83ec48';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/auth/')) {
        console.log(`AUTH API [${response.request().method()}]: ${url} -> ${response.status()}`);
        if (response.status() !== 200 && response.status() !== 201) {
            try {
                const body = await response.text();
                console.log(`AUTH ERROR BODY: ${body}`);
            } catch (e) {}
        }
    }
  });

  try {
    console.log('--- BUYER LOGIN ---');
    await page.goto(`${BASE_URL}/login`);
    
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) {
        await page.click('button:has-text("USE LEGACY MAIL")');
    }

    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 15000 });
    console.log('Logged in to /home');
    await page.waitForTimeout(3000);

    console.log('--- NAV TO LISTING ---');
    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    await page.waitForSelector('h1', { timeout: 10000 });
    
    console.log('Waiting for hydration on listing page...');
    // We'll wait until the Sign In button is GONE, or time out
    try {
        await page.waitForSelector('a:has-text("Sign In →")', { state: 'hidden', timeout: 10000 });
        console.log('Sign In button is gone. Hydration likely succeeded.');
    } catch (e) {
        console.log('Sign In button STILL visible after 10s.');
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'still_signed_out.png'), fullPage: true });
    }

    const requestButton = page.locator('button:has-text("Send Exchange Request")');
    if (await requestButton.isVisible()) {
        console.log('SUCCESS: Request section visible.');
        // ... (rest of the test)
    } else {
        console.log('FAIL: Request section missing.');
    }

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await browser.close();
  }
}

runTest();
