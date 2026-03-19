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
    if (response.url().includes('/auth/login')) {
        console.log(`LOGIN RESPONSE: ${response.status()}`);
        const headers = await response.allHeaders();
        console.log('LOGIN HEADERS:', JSON.stringify(headers, null, 2));
    }
    if (response.url().includes('/auth/refresh')) {
        console.log(`REFRESH RESPONSE: ${response.status()}`);
        const headers = await response.allHeaders();
        console.log('REFRESH HEADERS:', JSON.stringify(headers, null, 2));
    }
  });

  try {
    console.log('--- BUYER FLOW ---');
    await page.goto(`${BASE_URL}/login`);
    
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) {
        await page.click('button:has-text("USE LEGACY MAIL")');
    }

    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 15000 });
    console.log('Logged in. Waiting for cookies...');
    await page.waitForTimeout(2000);
    
    const cookies = await context.cookies();
    console.log('COOKIES:', JSON.stringify(cookies, null, 2));

    console.log('Navigating to listing...');
    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    await page.waitForTimeout(5000);

    const requestButton = page.locator('button:has-text("Send Exchange Request")');
    if (await requestButton.isVisible()) {
        console.log('Request button visible!');
    } else {
        console.log('Request button NOT visible.');
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_fail.png'), fullPage: true });
    }

  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await browser.close();
  }
}

runTest();
