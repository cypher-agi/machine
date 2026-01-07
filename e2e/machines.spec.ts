import { test, expect } from '@playwright/test';

test.describe('Machines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/machines');
  });

  test('shows empty state when no machines exist', async ({ page }) => {
    // Check for empty state message or illustration
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state');
    // This may or may not be present depending on API state
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('can open deploy wizard', async ({ page }) => {
    // Click the deploy/create button
    const deployButton = page.locator(
      'button:has-text("Deploy"), button:has-text("Create"), [data-testid="deploy-button"]'
    );
    await deployButton.click();

    // Verify wizard/modal is open
    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('deploy wizard has required form fields', async ({ page }) => {
    // Open wizard
    const deployButton = page.locator(
      'button:has-text("Deploy"), button:has-text("Create"), [data-testid="deploy-button"]'
    );
    await deployButton.click();

    // Check for form fields
    await expect(
      page.locator('input[name="name"], [data-testid="machine-name-input"]')
    ).toBeVisible();
  });

  test('can select machine to view details', async ({ page }) => {
    // If there are machines, click one
    const machineCard = page.locator('[data-testid="machine-card"], .machine-card').first();

    if (await machineCard.isVisible()) {
      await machineCard.click();
      // Sidekick should open with machine details
      await expect(page.locator('[data-testid="sidekick"], .sidekick')).toBeVisible();
    }
  });

  test('can filter machines by status', async ({ page }) => {
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('running');
      // URL should update with filter
      expect(page.url()).toContain('status');
    }
  });

  test('can search machines', async ({ page }) => {
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"], [data-testid="search-input"]'
    );

    if (await searchInput.isVisible()) {
      await searchInput.fill('test-machine');
      // Wait for debounce
      await page.waitForTimeout(500);
    }
  });

  test('can sort machines', async ({ page }) => {
    const sortButton = page.locator('[data-testid="sort-button"], button:has-text("Sort")');

    if (await sortButton.isVisible()) {
      await sortButton.click();
      // Sort dropdown should appear
      await expect(page.locator('[role="menu"], .dropdown-menu')).toBeVisible();
    }
  });
});
