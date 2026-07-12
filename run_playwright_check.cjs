const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function verifyLiveSite() {
  console.log('Starting Live Site Verification using Playwright (CommonJS)...');
  let browser;
  
  // Try launching system browsers
  const channels = ['chrome', 'msedge'];
  let launched = false;
  
  for (const channel of channels) {
    try {
      console.log(`Attempting to launch browser with channel: ${channel}`);
      browser = await chromium.launch({
        channel: channel,
        headless: true
      });
      launched = true;
      console.log(`Successfully launched browser with channel: ${channel}`);
      break;
    } catch (err) {
      console.log(`Failed to launch browser with channel ${channel}:`, err.message);
    }
  }
  
  if (!launched) {
    // Let's try some typical paths on Windows
    const typicalPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const executablePath of typicalPaths) {
      try {
        console.log(`Attempting to launch browser with executablePath: ${executablePath}`);
        if (fs.existsSync(executablePath)) {
          browser = await chromium.launch({
            executablePath: executablePath,
            headless: true
          });
          launched = true;
          console.log(`Successfully launched browser with executablePath: ${executablePath}`);
          break;
        } else {
          console.log(`Executable does not exist at path: ${executablePath}`);
        }
      } catch (err) {
        console.log(`Failed to launch browser at ${executablePath}:`, err.message);
      }
    }
  }
  
  if (!launched) {
    console.error('CRITICAL: Could not launch any browser (Chrome or Edge) using Playwright.');
    process.exit(1);
  }
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleLogs = [];
  const consoleErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text });
    if (type === 'error') {
      consoleErrors.push(text);
      console.log(`[Browser Console Error] ${text}`);
    } else {
      console.log(`[Browser Console Log] [${type}] ${text}`);
    }
  });

  try {
    console.log('Navigating to https://rgitrozgar.in/');
    const response = await page.goto('https://rgitrozgar.in/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log(`Page load status code: ${response ? response.status() : 'No Response'}`);
    
    // 1. Take home screenshot
    console.log('Taking homepage screenshot...');
    await page.screenshot({ path: 'live_homepage.png', fullPage: true });
    
    // 2. Check layout / readability in light mode (which is default)
    const bodyStyles = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      const htmlClass = document.documentElement.className;
      return {
        htmlClass,
        bg: style.backgroundColor,
        color: style.color,
        fontFamily: style.fontFamily
      };
    });
    console.log('Light Mode Styles:', bodyStyles);
    
    // 3. Switch to dark mode and check contrast / tokens
    console.log('Switching to dark mode via class injection...');
    await page.evaluate(() => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    });
    
    const darkStyles = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      const htmlClass = document.documentElement.className;
      return {
        htmlClass,
        bg: style.backgroundColor,
        color: style.color
      };
    });
    console.log('Dark Mode Styles:', darkStyles);
    
    console.log('Taking dark mode homepage screenshot...');
    await page.screenshot({ path: 'live_homepage_dark.png', fullPage: true });

    // Output all gathered information
    const summary = {
      success: true,
      statusCode: response ? response.status() : null,
      consoleErrors,
      consoleLogs,
      bodyStyles,
      darkStyles
    };
    
    fs.writeFileSync('verification_result.json', JSON.stringify(summary, null, 2));
    console.log('Verification completed successfully. Results written to verification_result.json.');
    
  } catch (err) {
    console.error('Error during verification navigation:', err);
    fs.writeFileSync('verification_result.json', JSON.stringify({
      success: false,
      error: err.message,
      consoleErrors,
      consoleLogs
    }, null, 2));
  } finally {
    await browser.close();
  }
}

verifyLiveSite();
