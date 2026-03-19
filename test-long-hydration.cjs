const { chromium } = require('playwright');
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

  page.on('console', msg => {
    const text = msg.text();
    console.log('BROWSER:', text);
  });

  try {
    console.log('Navigating to login...');
    await page.goto(`${BASE_URL}/login`);
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) await page.click('button:has-text("USE LEGACY MAIL")');
    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    await page.waitForURL(url => url.toString().includes('/home'));
    console.log('Logged in successfully.');
    
    // Give some time for initial hydration on home
    await page.waitForTimeout(5000);

    console.log(`Navigating to listing ${LISTING_ID}...`);
    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    
    // The page might show "Sign In" briefly before hydration finishes
    console.log('On listing page. Waiting for hydration (up to 40s)...');
    
    const requestButton = page.locator('button:has-text("Send Exchange Request")');
    
    // Wait for the button to appear - this indicates successful hydration and auth
    try {
        await requestButton.waitFor({ state: 'visible', timeout: 40000 });
        console.log('SUCCESS: Send Exchange Request button is visible.');
        
        // Take a screenshot of the success state
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'success_exchange_button.png'), fullPage: true });

        // Optional: Click it to see if the form opens
        await requestButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'exchange_form_opened.png'), fullPage: true });
        console.log('SUCCESS: Exchange form opened.');

    } catch (e) {
        console.log('FAIL: button not visible after 40s');
        const signInVisible = await page.locator('button:has-text("Sign In →")').isVisible();
        console.log('Is Sign In button visible?', signInVisible);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'failed_auth_on_listing.png'), fullPage: true });
    }

  } finally {
    await browser.close();
  }
}

runTest();
