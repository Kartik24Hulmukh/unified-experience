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

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Auth') || text.includes('Session') || text.includes('Cookie')) {
        console.log('BROWSER:', text);
    }
  });

  page.on('response', response => {
    if (response.url().includes('/auth/refresh')) {
        console.log(`REFRESH RESPONSE: ${response.status()}`);
    }
  });

  try {
    console.log('--- BUYER FLOW ---');
    await page.goto(`${BASE_URL}/login`);
    
    const legacyMailButton = page.locator('button:has-text("USE LEGACY MAIL")');
    if (await legacyMailButton.isVisible()) {
        await legacyMailButton.click();
    }

    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    
    await page.waitForURL(`${BASE_URL}/home`, { timeout: 15000 });
    console.log('Buyer logged in. Waiting for hydration...');
    await page.waitForTimeout(5000); // Robust wait for all auth checks
    
    const cookies = await context.cookies();
    console.log('Cookies after login:', cookies.map(c => c.name).join(', '));

    // 2. Go to Listing
    console.log('Navigating to listing...');
    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    await page.waitForSelector('h1', { timeout: 10000 });
    
    console.log('Waiting for hydration on listing page...');
    await page.waitForTimeout(5000);

    const requestButton = page.locator('button:has-text("Send Exchange Request")');
    const signInButton = page.locator('a:has-text("Sign In →")');
    
    if (await signInButton.first().isVisible()) {
        console.log('CRITICAL: Sign In button visible on listing page. Buyer NOT authenticated.');
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'auth_fail_listing_final.png'), fullPage: true });
        
        // Final attempt: Check if we can see the user in localStorage
        const user = await page.evaluate(() => localStorage.getItem('berozgar_auth'));
        console.log('LocalStorage user:', user);
    }

    if (await requestButton.isVisible()) {
        console.log('Request button found. Sending...');
        await page.fill('input[placeholder="Hi, I\'m interested in this item..."]', 'I want to buy this item.');
        await page.click('button:has-text("Send Exchange Request")');
        
        await page.waitForSelector('text=Request Sent Successfully', { timeout: 15000 });
        console.log('Exchange request sent.');
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'exchange_request_sent.png'), fullPage: true });

        // SELLER FLOW
        console.log('--- SELLER FLOW ---');
        await context.clearCookies();
        await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
        
        await page.goto(`${BASE_URL}/login`);
        if (await legacyMailButton.isVisible()) await legacyMailButton.click();
        await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'seller@mctrgit.ac.in');
        await page.fill('input[placeholder="••••••••"]', 'Test@123');
        await page.click('button:has-text("ENTER PORTAL")');
        await page.waitForURL(`${BASE_URL}/home`, { timeout: 15000 });
        await page.waitForTimeout(5000);
        
        await page.goto(`${BASE_URL}/profile`);
        await page.waitForTimeout(5000);
        
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'seller_profile.png'), fullPage: true });
        
        const acceptBtn = page.locator('button:has-text("ACCEPT")');
        if (await acceptBtn.isVisible()) {
            await acceptBtn.click();
            await page.waitForSelector('text=ACCEPTED', { timeout: 15000 });
            console.log('Accepted.');
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'exchange_accepted.png'), fullPage: true });
        } else {
            console.log('No accept button found.');
        }
    } else {
        throw new Error('Listing page request section missing.');
    }

  } catch (err) {
    console.error('Test FAILED:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'exchange_test_final_error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

runTest();
