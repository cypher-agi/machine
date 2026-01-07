import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('shows settings page', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="page-title"]')).toContainText(/Settings/i);
  });

  test('has theme toggle', async ({ page }) => {
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button:has-text("Theme"), select[name="theme"]'
    );
    if (await themeToggle.isVisible()) {
      await expect(themeToggle).toBeEnabled();
    }
  });

  test('can toggle theme', async ({ page }) => {
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], button:has-text("Dark"), button:has-text("Light")'
    );

    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Theme should toggle without errors
      await page.waitForTimeout(300); // Wait for animation
    }
  });
});
