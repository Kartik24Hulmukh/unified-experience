const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const LISTING_ID = 'cf253860-995f-462e-a7e8-bb97aa83ec48';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/login`);
    if (await page.locator('button:has-text("USE LEGACY MAIL")').isVisible()) await page.click('button:has-text("USE LEGACY MAIL")');
    await page.fill('input[placeholder="YOU@MCTRGIT.AC.IN"]', 'buyer@mctrgit.ac.in');
    await page.fill('input[placeholder="••••••••"]', 'Test@123');
    await page.click('button:has-text("ENTER PORTAL")');
    await page.waitForURL(`${BASE_URL}/home`);
    
    console.log('Cookies at /home:', JSON.stringify(await context.cookies(), null, 2));

    await page.goto(`${BASE_URL}/listing/${LISTING_ID}`);
    await page.waitForSelector('h1');
    
    console.log('Cookies at /listing:', JSON.stringify(await context.cookies(), null, 2));
    console.log('Storage at /listing:', await page.evaluate(() => localStorage.getItem('berozgar_auth')));

  } finally {
    await browser.close();
  }
}

runTest();
