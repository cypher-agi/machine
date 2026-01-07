import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('app loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Machina/i);
  });

  test('navigate to all pages', async ({ page }) => {
    // Machines page (default)
    await expect(page.locator('[data-testid="page-title"]')).toContainText(/Machines/i);

    // Navigate to Providers
    await page.click('a[href="/providers"]');
    await expect(page).toHaveURL('/providers');

    // Navigate to SSH Keys
    await page.click('a[href="/keys"]');
    await expect(page).toHaveURL('/keys');

    // Navigate to Deployments
    await page.click('a[href="/deployments"]');
    await expect(page).toHaveURL('/deployments');

    // Navigate to Bootstrap
    await page.click('a[href="/bootstrap"]');
    await expect(page).toHaveURL('/bootstrap');

    // Navigate to Settings
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL('/settings');
  });

  test('page titles update correctly', async ({ page }) => {
    await page.click('a[href="/providers"]');
    await expect(page.locator('h1, [data-testid="page-title"]')).toContainText(/Providers/i);

    await page.click('a[href="/keys"]');
    await expect(page.locator('h1, [data-testid="page-title"]')).toContainText(/SSH Keys/i);
  });

  test('URL updates correctly when navigating', async ({ page }) => {
    await page.click('a[href="/providers"]');
    expect(page.url()).toContain('/providers');

    await page.click('a[href="/machines"]');
    expect(page.url()).toContain('/machines');
  });

  test('browser back/forward works', async ({ page }) => {
    await page.click('a[href="/providers"]');
    await page.click('a[href="/keys"]');

    await page.goBack();
    await expect(page).toHaveURL('/providers');

    await page.goForward();
    await expect(page).toHaveURL('/keys');
  });
});
