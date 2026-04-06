const { chromium } = require('playwright');
const path = require('path');

async function capture(url, name) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  const page = await context.newPage();
  
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // Wait for listings to load
  await page.waitForTimeout(2000);
  
  const screenshotPath = `C:\\Users\\kadam\\.gemini\\antigravity\\brain\\ae20aacc-b3d8-4210-b9d0-ad28e8d95e11\\${name}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);
  
  await browser.close();
}

async function main() {
  try {
    // We need to find the UUIDs since we removed mock data
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // 1. Resale
    await page.goto('http://localhost:8080/resale', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); 
    // Find the first listing link or card
    const resaleLink = await page.locator('a[href*="/listing/"]').first();
    if (await resaleLink.count() > 0) {
        const href = await resaleLink.getAttribute('href');
        console.log(`Found resale listing: ${href}`);
        await capture(`http://localhost:8080${href}`, 'resale_detail_375px');
    } else {
        console.log('No resale listings found');
        await page.screenshot({ path: `C:\\Users\\kadam\\.gemini\\antigravity\\brain\\ae20aacc-b3d8-4210-b9d0-ad28e8d95e11\\resale_list_empty.png` });
    }

    // 2. Skills
    await page.goto('http://localhost:8080/skills', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const skillsLink = await page.locator('a[href*="/listing/"]').first();
    if (await skillsLink.count() > 0) {
        const href = await skillsLink.getAttribute('href');
        console.log(`Found skills listing: ${href}`);
        await capture(`http://localhost:8080${href}`, 'skills_detail_375px');
    } else {
        console.log('No skills listings found');
        await page.screenshot({ path: `C:\\Users\\kadam\\.gemini\\antigravity\\brain\\ae20aacc-b3d8-4210-b9d0-ad28e8d95e11\\skills_list_empty.png` });
    }

    await browser.close();
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  }
}

main();
