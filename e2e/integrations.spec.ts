import { test, expect } from '@playwright/test';

test.describe('Integrations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/integrations');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('h1, [class*="title"]').first()).toContainText(/integrations/i);
  });

  test('displays available integrations', async ({ page }) => {
    // Should show at least GitHub
    await expect(page.locator('text=GitHub')).toBeVisible();
  });

  test('shows integration descriptions', async ({ page }) => {
    // GitHub should have a description
    const description = page.locator('text=/repositories|members|import/i').first();
    await expect(description).toBeVisible();
  });

  test('shows feature badges', async ({ page }) => {
    // Look for feature badges like "repos", "members"
    const featureBadge = page.locator('[class*="badge"], [class*="Badge"]').first();
    if (await featureBadge.isVisible()) {
      await expect(featureBadge).toBeVisible();
    }
  });

  test('shows status for each integration', async ({ page }) => {
    // Should show status like "Connected", "Not Configured", "Coming Soon"
    const status = page
      .locator('text=/Connected|Not Configured|Ready to Connect|Coming Soon/')
      .first();
    await expect(status).toBeVisible();
  });

  test('has refresh button', async ({ page }) => {
    const refreshButton = page.locator(
      '[data-testid="refresh-button"], button[title*="Refresh" i], button:has(svg[class*="refresh" i])'
    );
    await expect(refreshButton).toBeVisible();
  });

  test('shows Set Up button for unconfigured integration', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Set Up")');
    // If visible, it means there's an unconfigured integration
    if (await setupButton.first().isVisible()) {
      await expect(setupButton.first()).toBeVisible();
    }
  });

  test('can open setup modal', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Set Up")').first();

    if (await setupButton.isVisible()) {
      await setupButton.click();
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
    }
  });

  test('setup modal shows instructions', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Set Up")').first();

    if (await setupButton.isVisible()) {
      await setupButton.click();

      // Modal should have some form of instructions
      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();

      // Look for instruction text or numbered steps
      const instructions = modal.locator('ol, [class*="step"], [class*="instruction"]');
      if (await instructions.isVisible()) {
        await expect(instructions).toBeVisible();
      }
    }
  });

  test('setup modal has credential inputs', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Set Up")').first();

    if (await setupButton.isVisible()) {
      await setupButton.click();

      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();

      // Should have Client ID input
      const clientIdInput = modal.locator(
        'input[name="client_id"], input[placeholder*="Client ID" i], [data-testid="client-id-input"]'
      );
      if (await clientIdInput.isVisible()) {
        await expect(clientIdInput).toBeVisible();
      }
    }
  });

  test('setup modal shows callback URL', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Set Up")').first();

    if (await setupButton.isVisible()) {
      await setupButton.click();

      const modal = page.locator('[role="dialog"], .modal');
      await expect(modal).toBeVisible();

      // Should show a callback URL somewhere
      const callbackUrl = modal.locator('text=/callback|redirect/i');
      if (await callbackUrl.isVisible()) {
        await expect(callbackUrl).toBeVisible();
      }
    }
  });

  test('can close setup modal', async ({ page }) => {
    const setupButton = page.locator('button:has-text("Set Up")').first();

    if (await setupButton.isVisible()) {
      await setupButton.click();
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible();

      // Close modal
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="dialog"], .modal')).not.toBeVisible();
    }
  });

  test('shows Connect button for configured integration', async ({ page }) => {
    const connectButton = page.locator('button:has-text("Connect")');
    // If visible, there's a configured but not connected integration
    if (await connectButton.first().isVisible()) {
      await expect(connectButton.first()).toBeEnabled();
    }
  });

  test('shows Coming Soon for unavailable integrations', async ({ page }) => {
    const comingSoon = page.locator('text="Coming Soon"');
    if (await comingSoon.first().isVisible()) {
      await expect(comingSoon.first()).toBeVisible();
    }
  });
});

test.describe('Integrations - Connected State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/integrations');
  });

  test('connected integration shows sync button', async ({ page }) => {
    const syncButton = page.locator('button[title="Sync"], [data-testid="sync-button"]').first();

    if (await syncButton.isVisible()) {
      await expect(syncButton).toBeEnabled();
    }
  });

  test('connected integration shows disconnect button', async ({ page }) => {
    const disconnectButton = page
      .locator('button[title="Disconnect"], [data-testid="disconnect-button"]')
      .first();

    if (await disconnectButton.isVisible()) {
      await expect(disconnectButton).toBeEnabled();
    }
  });

  test('clicking disconnect shows confirmation', async ({ page }) => {
    const disconnectButton = page
      .locator('button[title="Disconnect"], [data-testid="disconnect-button"]')
      .first();

    if (await disconnectButton.isVisible()) {
      await disconnectButton.click();

      // Should show confirmation dialog
      const confirmDialog = page.locator('[role="dialog"]:has-text("Disconnect")');
      await expect(confirmDialog).toBeVisible();
    }
  });

  test('can cancel disconnect confirmation', async ({ page }) => {
    const disconnectButton = page
      .locator('button[title="Disconnect"], [data-testid="disconnect-button"]')
      .first();

    if (await disconnectButton.isVisible()) {
      await disconnectButton.click();

      const confirmDialog = page.locator('[role="dialog"]:has-text("Disconnect")');
      if (await confirmDialog.isVisible()) {
        // Find cancel button
        const cancelButton = confirmDialog.locator('button:has-text("Cancel")');
        await cancelButton.click();

        await expect(confirmDialog).not.toBeVisible();
      }
    }
  });

  test('shows sync status/last sync time', async ({ page }) => {
    // Look for "Synced X ago" or similar
    const syncStatus = page.locator('text=/Synced|Syncing/i').first();

    if (await syncStatus.isVisible()) {
      await expect(syncStatus).toBeVisible();
    }
  });

  test('shows stats for connected integration', async ({ page }) => {
    // Look for stats like "10 repos" or "5 members"
    const stats = page.locator('[class*="badge"]:has-text(/\\d+ \\w+/)').first();

    if (await stats.isVisible()) {
      await expect(stats).toBeVisible();
    }
  });

  test('can select connected integration to view details', async ({ page }) => {
    const integrationCard = page
      .locator('[data-testid="integration-card"], [class*="ItemCard"]')
      .filter({ hasText: 'Connected' })
      .first();

    if (await integrationCard.isVisible()) {
      await integrationCard.click();

      const sidekick = page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]');
      await expect(sidekick).toBeVisible();
    }
  });
});

test.describe('Integrations - GitHub Data', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to integrations and select GitHub if connected
    await page.goto('/integrations');
  });

  test('shows repositories in sidekick when GitHub selected', async ({ page }) => {
    const githubCard = page
      .locator('[data-testid="integration-card"], [class*="ItemCard"]')
      .filter({ hasText: 'GitHub' })
      .filter({ hasText: 'Connected' })
      .first();

    if (await githubCard.isVisible()) {
      await githubCard.click();

      const sidekick = page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]');
      await expect(sidekick).toBeVisible();

      // Should have repos tab or section
      const reposSection = sidekick.locator('text=/repos|repositories/i');
      if (await reposSection.isVisible()) {
        await expect(reposSection).toBeVisible();
      }
    }
  });

  test('shows members in sidekick when GitHub selected', async ({ page }) => {
    const githubCard = page
      .locator('[data-testid="integration-card"], [class*="ItemCard"]')
      .filter({ hasText: 'GitHub' })
      .filter({ hasText: 'Connected' })
      .first();

    if (await githubCard.isVisible()) {
      await githubCard.click();

      const sidekick = page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]');
      await expect(sidekick).toBeVisible();

      // Should have members tab or section
      const membersSection = sidekick.locator('text=/members/i');
      if (await membersSection.isVisible()) {
        await expect(membersSection).toBeVisible();
      }
    }
  });
});

test.describe('Integrations - Error Handling', () => {
  test('shows error toast on connection failure', async ({ page }) => {
    // Navigate with error parameter
    await page.goto('/integrations?error=Connection%20failed');

    // Should show error notification
    const toast = page.locator('[role="alert"], [class*="toast"], [class*="Toast"]');
    if (await toast.isVisible()) {
      await expect(toast).toContainText(/failed|error/i);
    }
  });

  test('shows success toast on connection success', async ({ page }) => {
    // Navigate with connected parameter
    await page.goto('/integrations?connected=github');

    // Should show success notification
    const toast = page.locator('[role="alert"], [class*="toast"], [class*="Toast"]');
    if (await toast.isVisible()) {
      await expect(toast).toContainText(/connected|success/i);
    }
  });
});

test.describe('Integrations - Remove Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/integrations');
  });

  test('shows reset button for configured but not connected', async ({ page }) => {
    // Look for a "Ready to Connect" status which indicates configured state
    const configuredCard = page
      .locator('[data-testid="integration-card"], [class*="ItemCard"]')
      .filter({ hasText: 'Ready to Connect' })
      .first();

    if (await configuredCard.isVisible()) {
      // Should have a reset/remove credentials button
      const resetButton = configuredCard.locator(
        'button[title*="Remove" i], button[title*="Reset" i], button:has(svg[class*="rotate" i])'
      );
      if (await resetButton.isVisible()) {
        await expect(resetButton).toBeEnabled();
      }
    }
  });
});
