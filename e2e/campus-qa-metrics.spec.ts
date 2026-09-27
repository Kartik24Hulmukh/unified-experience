/** Read-only smoke test against a dedicated staging admin; no fabricated metrics. */
import { test, expect } from '@playwright/test';
const email = process.env.E2E_QA_ADMIN_EMAIL;
const password = process.env.E2E_QA_ADMIN_PASSWORD;
test('admin can load weekly Q&A evidence through a real session', async ({ page }) => {
  test.skip(!email || !password, 'Requires dedicated staging admin credentials');
  await page.goto('/login');
  await page.getByTestId('email-input').fill(email!);
  await page.getByTestId('password-input').fill(password!);
  await page.getByTestId('password-input').press('Enter');
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload(); // Exercise refresh-cookie session hydration too.
  await page.getByRole('button', { name: 'Q&A Demand Gaps' }).click();
  const panel = page.getByRole('region', { name: 'Weekly Q&A evidence' });
  await expect(panel.getByRole('table')).toBeVisible();
  await expect(panel.getByRole('columnheader', { name: 'Reopened' })).toBeVisible();
  await expect(panel.getByRole('row')).toHaveCount(9); // Header + eight weeks.
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Refresh metrics' }).click();
  await expect(panel.getByRole('button', { name: 'Refresh metrics' })).toBeEnabled();
  await expect(panel.getByRole('alert')).toHaveCount(0);
});
