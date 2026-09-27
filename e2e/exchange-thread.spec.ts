import { test, expect } from '@playwright/test';
// Use dedicated synthetic staging accounts. No production/student credentials in source.
test('verified participant can persist and reload an exchange conversation', async ({ page }) => {
  const email = process.env.E2E_EXCHANGE_EMAIL;
  const password = process.env.E2E_EXCHANGE_PASSWORD;
  const requestId = process.env.E2E_EXCHANGE_REQUEST_ID;
  test.skip(!email || !password || !requestId, 'Requires a synthetic verified participant with an active request');
  await page.goto('/login');
  await page.getByTestId('email-input').fill(email!);
  await page.getByTestId('password-input').fill(password!);
  await page.getByTestId('login-submit').click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto('/profile');
  const thread = page.locator('section[aria-label="Exchange conversation"]').filter({ has: page.locator(`textarea[id="message-${requestId}"]`) });
  // Locate the request card by the displayed short ID, not its list position.
  const card = page.locator('div.p-6').filter({ has: page.getByText(requestId!.slice(0, 8), { exact: true }) });
  await card.getByRole('button', { name: 'Open conversation' }).click();
  const text = `Synthetic meeting check ${Date.now()}`;
  await thread.getByLabel('Message your exchange partner').fill(text);
  await thread.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(thread.getByText(text, { exact: true })).toBeVisible();
  await page.reload();
  await card.getByRole('button', { name: 'Open conversation' }).click();
  await expect(thread.getByText(text, { exact: true })).toBeVisible();
});
