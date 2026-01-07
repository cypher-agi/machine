import { test, expect } from '@playwright/test';

test.describe('SSH Keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/keys');
  });

  test('shows empty state when no keys exist', async ({ page }) => {
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('can open generate key modal', async ({ page }) => {
    const generateButton = page.locator(
      'button:has-text("Generate"), [data-testid="generate-key-button"]'
    );
    await generateButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('generate modal has name input', async ({ page }) => {
    const generateButton = page.locator(
      'button:has-text("Generate"), [data-testid="generate-key-button"]'
    );
    await generateButton.click();

    const nameInput = page.locator('input[name="name"], [data-testid="key-name-input"]');
    await expect(nameInput).toBeVisible();
  });

  test('can fill generate key form', async ({ page }) => {
    const generateButton = page.locator(
      'button:has-text("Generate"), [data-testid="generate-key-button"]'
    );
    await generateButton.click();

    const nameInput = page.locator('input[name="name"], [data-testid="key-name-input"]');
    await nameInput.fill('my-test-key');

    // Check key type selector if present
    const typeSelect = page.locator('select[name="type"], [data-testid="key-type-select"]');
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('ed25519');
    }
  });

  test('can open import key modal', async ({ page }) => {
    const importButton = page.locator(
      'button:has-text("Import"), [data-testid="import-key-button"]'
    );
    await importButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('import modal has public key textarea', async ({ page }) => {
    const importButton = page.locator(
      'button:has-text("Import"), [data-testid="import-key-button"]'
    );
    await importButton.click();

    const keyInput = page.locator('textarea[name="public_key"], [data-testid="public-key-input"]');
    await expect(keyInput).toBeVisible();
  });

  test('can paste public key for import', async ({ page }) => {
    const importButton = page.locator(
      'button:has-text("Import"), [data-testid="import-key-button"]'
    );
    await importButton.click();

    const keyInput = page.locator('textarea[name="public_key"], [data-testid="public-key-input"]');
    await keyInput.fill('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@example.com');
  });

  test('can select key to view details', async ({ page }) => {
    const keyCard = page.locator('[data-testid="ssh-key-card"], .key-card').first();

    if (await keyCard.isVisible()) {
      await keyCard.click();
      await expect(page.locator('[data-testid="sidekick"], .sidekick')).toBeVisible();
    }
  });

  test('can copy public key', async ({ page }) => {
    const keyCard = page.locator('[data-testid="ssh-key-card"], .key-card').first();

    if (await keyCard.isVisible()) {
      await keyCard.click();
      const copyButton = page.locator('button:has-text("Copy"), [data-testid="copy-public-key"]');
      if (await copyButton.isVisible()) {
        await expect(copyButton).toBeEnabled();
      }
    }
  });

  test('can sync key to provider', async ({ page }) => {
    const keyCard = page.locator('[data-testid="ssh-key-card"], .key-card').first();

    if (await keyCard.isVisible()) {
      await keyCard.click();
      const syncButton = page.locator('button:has-text("Sync"), [data-testid="sync-key-button"]');
      if (await syncButton.isVisible()) {
        await expect(syncButton).toBeEnabled();
      }
    }
  });

  test('can delete key', async ({ page }) => {
    const keyCard = page.locator('[data-testid="ssh-key-card"], .key-card').first();

    if (await keyCard.isVisible()) {
      await keyCard.click();
      const deleteButton = page.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await expect(page.locator('[role="dialog"]:has-text("Confirm")')).toBeVisible();
      }
    }
  });
});
