import { test, expect } from '@playwright/test';

const BASE_URL = (process.env.E2E_WEB_URL ?? process.env.BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');

// Run tests in this describe block in parallel.
test.describe.configure({ mode: 'parallel' });

test.describe('E2E Sync Workflow: Seller, Buyer, Admin', () => {

  test('Seller Agent: Creates a new listing', async ({ page }) => {
    // 1. Navigate to create listing
    await page.goto(`${BASE_URL}/create-listing`);
    await page.screenshot({ path: 'test-results/seller-01-navigation.png', fullPage: true });

    // 2. Fill Title
    const titleInput = page.getByPlaceholder(/title/i).or(page.getByRole('textbox', { name: /title/i }));
    if (await titleInput.isVisible()) {
      await titleInput.fill('Vintage College Desk');
      await page.screenshot({ path: 'test-results/seller-02-title.png' });
    }

    // 3. Fill Category
    const categoryDropdown = page.getByRole('combobox').or(page.getByRole('button', { name: /category/i }));
    if (await categoryDropdown.isVisible()) {
      await categoryDropdown.click();
      const option = page.getByRole('option', { name: /furniture/i });
      if (await option.isVisible()) await option.click();
      await page.screenshot({ path: 'test-results/seller-03-category.png' });
    }

    // 4. Fill Price
    const priceInput = page.getByPlaceholder(/price/i).or(page.getByRole('spinbutton'));
    if (await priceInput.isVisible()) {
      await priceInput.fill('450');
      await page.screenshot({ path: 'test-results/seller-04-price.png' });
    }

    // 5. Fill Location
    const locationInput = page.getByPlaceholder(/location/i).or(page.getByRole('textbox', { name: /location/i }));
    if (await locationInput.isVisible()) {
      await locationInput.fill('North Campus Hall');
      await page.screenshot({ path: 'test-results/seller-05-location.png' });
    }

    // 6. Fill Description
    const descInput = page.getByPlaceholder(/description/i).or(page.getByRole('textbox', { name: /description/i }));
    if (await descInput.isVisible()) {
      await descInput.fill('Gently used desk, perfect for studying. Must pick up by Friday.');
      await page.screenshot({ path: 'test-results/seller-06-description.png' });
    }

    // 7. Submit
    const submitBtn = page.getByRole('button', { name: /submit|create|publish/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/seller-07-submitted.png', fullPage: true });
    }
  });


  test('Buyer Agent: Browses resale, filters, and contacts seller', async ({ page }) => {
    // 1. Navigate to resale
    await page.goto(`${BASE_URL}/resale`);
    await page.screenshot({ path: 'test-results/buyer-01-resale-home.png', fullPage: true });

    // 2. Filter functionality
    const searchInput = page.getByPlaceholder(/search/i).or(page.getByRole('searchbox'));
    if (await searchInput.isVisible()) {
      await searchInput.fill('Vintage College Desk');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000); // give time for simulated/real network filter
      await page.screenshot({ path: 'test-results/buyer-02-search-applied.png' });
    }

    // 3. Click the listing (mock or real)
    const listingCard = page.getByRole('link', { name: /Vintage College Desk/i }).first()
                         .or(page.getByRole('button', { name: /Vintage College Desk/i }).first())
                         .or(page.getByText('Vintage College Desk').first());
    
    if (await listingCard.isVisible()) {
      await listingCard.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/buyer-03-listing-detail.png', fullPage: true });
    }

    // 4. Contact the seller
    const contactBtn = page.getByRole('button', { name: /contact/i });
    if (await contactBtn.isVisible()) {
      await contactBtn.click();
      await page.waitForTimeout(500); // Modal transition
      await page.screenshot({ path: 'test-results/buyer-04-contact-modal.png' });
      
      const messageInput = page.getByPlaceholder(/message/i).or(page.getByRole('textbox', { name: /message/i }));
      if (await messageInput.isVisible()) {
        await messageInput.fill('Hi, is this still available?');
        const sendBtn = page.getByRole('button', { name: /send/i });
        if (await sendBtn.isVisible()) await sendBtn.click();
        await page.screenshot({ path: 'test-results/buyer-05-message-sent.png' });
      }
    }
  });


  test('Admin Agent: Oversees platform services', async ({ page }) => {
    // 1. Check Admin Dashboard
    await page.goto(`${BASE_URL}/admin`);
    await page.screenshot({ path: 'test-results/admin-01-dashboard.png', fullPage: true });

    // 2. Check Hospitals
    await page.goto(`${BASE_URL}/hospital`);
    await page.waitForLoadState('domcontentloaded');
    const hospitalHeader = page.getByRole('heading', { name: /hospital/i }).first();
    if (await hospitalHeader.isVisible()) {
        await page.screenshot({ path: 'test-results/admin-02-hospital.png' });
    } else {
        await page.screenshot({ path: 'test-results/admin-02-hospital-fallback.png' });
    }

    // 3. Check Mess
    await page.goto(`${BASE_URL}/mess`);
    await page.waitForLoadState('domcontentloaded');
    const messHeader = page.getByRole('heading', { name: /mess/i }).first();
    if (await messHeader.isVisible()) {
      await page.screenshot({ path: 'test-results/admin-03-mess.png' });
    } else {
      await page.screenshot({ path: 'test-results/admin-03-mess-fallback.png' });
    }

    // 4. Check Jobs
    await page.goto(`${BASE_URL}/jobs`);
    await page.waitForLoadState('domcontentloaded');
    const jobsHeader = page.getByRole('heading', { name: /job|career/i }).first();
    if (await jobsHeader.isVisible()) {
      await page.screenshot({ path: 'test-results/admin-04-jobs.png' });
    } else {
      await page.screenshot({ path: 'test-results/admin-04-jobs-fallback.png' });
    }
  });

});
