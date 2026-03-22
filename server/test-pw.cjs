const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    fs.appendFileSync('pw-console.log', `[${msg.type()}] ${msg.text()}\n`);
    console.log(`[Browser] ${msg.text()}`);
  });

  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:8080/login');
    
    console.log('Waiting for email input...');
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    
    console.log('Filling form...');
    await page.fill('input[name="email"]', 'testuser@mctrgit.ac.in');
    await page.fill('input[name="password"]', 'Seller@1234');
    
    console.log('Clicking login...');
    await page.click('button[type="submit"]');

    console.log('Waiting for redirect...');
    await page.waitForURL('**/home', { timeout: 15000 });
    console.log('Landed on /home');

    await page.waitForTimeout(2000);

    // Reload the page exactly like open_browser_url
    console.log('Reloading the page...');
    await page.goto('http://localhost:8080/home');
    
    console.log('Waiting after reload...');
    await page.waitForTimeout(5000);

    console.log('Final URL:', page.url());

    console.log('Done!');
  } catch (e) {
    console.error('Test script error:', e);
  } finally {
    await browser.close();
  }
})();
