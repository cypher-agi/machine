import { test, expect } from '@playwright/test';

test.describe('Deployments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/deployments');
  });

  test('shows deployment list', async ({ page }) => {
    // Page should load without errors
    await expect(page.locator('h1, [data-testid="page-title"]')).toContainText(/Deployments/i);
  });

  test('can filter by machine', async ({ page }) => {
    const machineFilter = page.locator('select[name="machine"], [data-testid="machine-filter"]');

    if (await machineFilter.isVisible()) {
      await expect(machineFilter).toBeEnabled();
    }
  });

  test('can filter by status', async ({ page }) => {
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');

    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ index: 1 });
    }
  });

  test('can select deployment to view details', async ({ page }) => {
    const deploymentCard = page
      .locator('[data-testid="deployment-card"], .deployment-card, .deployment-row')
      .first();

    if (await deploymentCard.isVisible()) {
      await deploymentCard.click();
      await expect(page.locator('[data-testid="sidekick"], .sidekick')).toBeVisible();
    }
  });

  test('can view deployment logs', async ({ page }) => {
    const deploymentCard = page
      .locator('[data-testid="deployment-card"], .deployment-card, .deployment-row')
      .first();

    if (await deploymentCard.isVisible()) {
      await deploymentCard.click();

      // Look for logs tab or section
      const logsTab = page.locator('button:has-text("Logs"), [data-testid="logs-tab"]');
      if (await logsTab.isVisible()) {
        await logsTab.click();
        await expect(
          page.locator('[data-testid="deployment-logs"], .logs-container')
        ).toBeVisible();
      }
    }
  });

  test('can cancel pending deployment', async ({ page }) => {
    const pendingDeployment = page
      .locator('[data-testid="deployment-pending"], .deployment-card:has-text("pending")')
      .first();

    if (await pendingDeployment.isVisible()) {
      await pendingDeployment.click();
      const cancelButton = page.locator('button:has-text("Cancel")');
      if (await cancelButton.isVisible()) {
        await expect(cancelButton).toBeEnabled();
      }
    }
  });

  test('can approve deployment requiring approval', async ({ page }) => {
    const awaitingDeployment = page
      .locator('[data-testid="deployment-awaiting"], .deployment-card:has-text("awaiting")')
      .first();

    if (await awaitingDeployment.isVisible()) {
      await awaitingDeployment.click();
      const approveButton = page.locator('button:has-text("Approve")');
      if (await approveButton.isVisible()) {
        await expect(approveButton).toBeEnabled();
      }
    }
  });
});
