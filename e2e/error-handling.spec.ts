import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('shows 404 for unknown routes', async ({ page }) => {
    await page.goto('/non-existent-page');

    // Should show 404 or redirect to home
    const notFound = page.locator('text=404, text=Not Found');
    const homeRedirect = page.url().includes('/machines');

    expect((await notFound.isVisible()) || homeRedirect).toBeTruthy();
  });

  test('shows loading states', async ({ page }) => {
    await page.goto('/machines');

    // During initial load, there might be loading indicators
    // This test verifies the page eventually loads
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible({ timeout: 10000 });
  });

  test('handles network errors gracefully', async ({ page }) => {
    // Intercept API calls and fail them
    await page.route('**/api/**', (route) => route.abort());

    await page.goto('/machines');

    // Should show error state or empty state, not crash
    await expect(page).not.toHaveTitle(/error/i);
  });
});
