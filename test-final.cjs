const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kadam\\.gemini\\antigravity\\brain\\ae20aacc-b3d8-4210-b9d0-ad28e8d95e11';
const BASE_URL = 'http://127.0.0.1:8080';
const LISTING_ID = 'cf253860-995f-462e-a7e8-bb97aa83ec48';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
        console.log(`API [${response.request().method()}]: ${url} -> ${response.status()}`);
    }
  });

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  try {
    await page.goto(`${BASE_URL}/login`);
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) await page.click('button:has-text("USE LEGACY MAIL")');
    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    await page.waitForURL(url => url.toString().includes('/home'));
    
    await page.waitForTimeout(2000);

    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    await page.waitForSelector('h1');
    
    // Wait for hydration logs
    console.log('Waiting for Send Exchange Request button...');
    const requestButton = page.locator('button:has-text("Send Exchange Request")');
    
    try {
        await requestButton.waitFor({ state: 'visible', timeout: 20000 });
        console.log('SUCCESS');
    } catch (e) {
        console.log('FAIL: button not visible');
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'final_attempt.png'), fullPage: true });
    }

  } finally {
    await browser.close();
  }
}

runTest();
