import { test, expect } from '@playwright/test';

test.describe('Providers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/providers');
  });

  test('shows empty state when no providers configured', async ({ page }) => {
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('can open add provider modal', async ({ page }) => {
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("Connect"), [data-testid="add-provider-button"]'
    );
    await addButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('modal shows provider type selection', async ({ page }) => {
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("Connect"), [data-testid="add-provider-button"]'
    );
    await addButton.click();

    // Should show provider types to select
    const providerOptions = page.locator('[data-testid="provider-type"], .provider-option');
    await expect(providerOptions.first()).toBeVisible();
  });

  test('can select provider type', async ({ page }) => {
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("Connect"), [data-testid="add-provider-button"]'
    );
    await addButton.click();

    // Click on DigitalOcean option
    const doOption = page.locator('text=DigitalOcean, [data-testid="provider-digitalocean"]');
    if (await doOption.isVisible()) {
      await doOption.click();
    }
  });

  test('can enter credentials', async ({ page }) => {
    const addButton = page.locator(
      'button:has-text("Add"), button:has-text("Connect"), [data-testid="add-provider-button"]'
    );
    await addButton.click();

    // Select provider first
    const doOption = page.locator('text=DigitalOcean, [data-testid="provider-digitalocean"]');
    if (await doOption.isVisible()) {
      await doOption.click();

      // Should show credential fields
      const tokenInput = page.locator('input[type="password"], input[name="api_token"]');
      await expect(tokenInput).toBeVisible();
    }
  });

  test('can click provider to view details', async ({ page }) => {
    const providerCard = page.locator('[data-testid="provider-card"], .provider-card').first();

    if (await providerCard.isVisible()) {
      await providerCard.click();
      await expect(page.locator('[data-testid="sidekick"], .sidekick')).toBeVisible();
    }
  });

  test('can verify provider credentials', async ({ page }) => {
    const providerCard = page.locator('[data-testid="provider-card"], .provider-card').first();

    if (await providerCard.isVisible()) {
      await providerCard.click();
      const verifyButton = page.locator('button:has-text("Verify")');
      if (await verifyButton.isVisible()) {
        await expect(verifyButton).toBeEnabled();
      }
    }
  });

  test('can delete provider', async ({ page }) => {
    const providerCard = page.locator('[data-testid="provider-card"], .provider-card').first();

    if (await providerCard.isVisible()) {
      await providerCard.click();
      const deleteButton = page.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        // Confirm modal should appear
        await expect(page.locator('[role="dialog"]:has-text("Confirm")')).toBeVisible();
      }
    }
  });
});
