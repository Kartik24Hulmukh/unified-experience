const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\kadam\\.gemini\\antigravity\\brain\\ae20aacc-b3d8-4210-b9d0-ad28e8d95e11';
const BASE_URL = 'http://localhost:8080';
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

  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('--- LOGIN ---');
    await page.goto(`${BASE_URL}/login`);
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) await page.click('button:has-text("USE LEGACY MAIL")');
    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    await page.waitForURL(`${BASE_URL}/home`);
    
    await page.waitForTimeout(2000);

    console.log('--- NAV ---');
    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    // Wait for the h1 to be sure the page is rendered
    await page.waitForSelector('h1', { timeout: 15000 });
    
    console.log('Waiting for hydration (30s)...');
    await page.waitForTimeout(30000);
    
    const requestButton = page.locator('button:has-text("Send Exchange Request")');
    if (await requestButton.isVisible()) {
        console.log('SUCCESS');
    } else {
        console.log('FAIL');
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'timeout_debug.png'), fullPage: true });
    }

  } finally {
    await browser.close();
  }
}

runTest();
