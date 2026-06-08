import { expect, test } from '@playwright/test';

test('loads dashboard and navigates through first rewrite routes', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Field intelligence dashboard' })).toBeVisible();
  await expect(page.getByText('Fresno County almond block')).toBeVisible();

  await page.getByRole('link', { name: 'Agronomy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agronomy location summary' })).toBeVisible();
  await page.getByRole('button', { name: 'Load summary' }).click();
  await expect(page.getByText('All sources healthy')).toBeVisible();

  await page.getByRole('link', { name: 'Ask', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ask agronomy' })).toBeVisible();
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByText(/apply about/i)).toBeVisible();

  await page.getByRole('link', { name: 'Diagnostics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Diagnostics' })).toBeVisible();
  await expect(page.getByText('agronomy-gateway-mock')).toBeVisible();
  await expect(page.getByText('ai-search-mock')).toBeVisible();
});
