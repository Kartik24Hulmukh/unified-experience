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

  try {
    console.log('--- LOGIN ---');
    await page.goto(`${BASE_URL}/login`);
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) await page.click('button:has-text("USE LEGACY MAIL")');
    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 15000 });
    
    console.log('Local Storage at /home:', await page.evaluate(() => localStorage.getItem('berozgar_auth')));

    console.log('--- NAV ---');
    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    await page.waitForSelector('h1');
    
    console.log('Local Storage at /listing:', await page.evaluate(() => localStorage.getItem('berozgar_auth')));
    
    await page.waitForTimeout(5000);
    const authState = await page.evaluate(() => {
        const auth = JSON.parse(localStorage.getItem('berozgar_auth') || 'null');
        return { 
            auth, 
            html: document.body.innerText.substring(0, 500) 
        };
    });
    console.log('Final State:', JSON.stringify(authState, null, 2));

  } finally {
    await browser.close();
  }
}

runTest();
