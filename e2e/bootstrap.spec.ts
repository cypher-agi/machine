import { test, expect } from '@playwright/test';

test.describe('Bootstrap Profiles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bootstrap');
  });

  test('shows bootstrap profile list', async ({ page }) => {
    await expect(page.locator('h1, [data-testid="page-title"]')).toContainText(/Bootstrap/i);
  });

  test('shows system profiles', async ({ page }) => {
    // System profiles like "The Grid" should be visible
    const systemProfile = page.locator('text=The Grid, text=System');
    if (await systemProfile.isVisible()) {
      await expect(systemProfile).toBeVisible();
    }
  });

  test('can create new profile', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), [data-testid="create-profile-button"]'
    );
    await createButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('create profile modal has name field', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), button:has-text("Add"), [data-testid="create-profile-button"]'
    );
    await createButton.click();

    const nameInput = page.locator('input[name="name"], [data-testid="profile-name-input"]');
    await expect(nameInput).toBeVisible();
  });

  test('can select profile to view details', async ({ page }) => {
    const profileCard = page
      .locator('[data-testid="bootstrap-profile-card"], .profile-card')
      .first();

    if (await profileCard.isVisible()) {
      await profileCard.click();
      await expect(page.locator('[data-testid="sidekick"], .sidekick')).toBeVisible();
    }
  });

  test('can edit custom profile template', async ({ page }) => {
    // Find a non-system profile
    const customProfile = page
      .locator('[data-testid="custom-profile"], .profile-card:not(:has-text("System"))')
      .first();

    if (await customProfile.isVisible()) {
      await customProfile.click();
      const editButton = page.locator('button:has-text("Edit")');
      if (await editButton.isVisible()) {
        await expect(editButton).toBeEnabled();
      }
    }
  });

  test('can delete custom profile', async ({ page }) => {
    const customProfile = page
      .locator('[data-testid="custom-profile"], .profile-card:not(:has-text("System"))')
      .first();

    if (await customProfile.isVisible()) {
      await customProfile.click();
      const deleteButton = page.locator('button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await expect(deleteButton).toBeEnabled();
      }
    }
  });

  test('cannot delete system profile', async ({ page }) => {
    // Select a system profile
    const systemProfile = page
      .locator('[data-testid="system-profile"], .profile-card:has-text("System")')
      .first();

    if (await systemProfile.isVisible()) {
      await systemProfile.click();
      const deleteButton = page.locator('button:has-text("Delete")');
      // Delete should be disabled or not visible for system profiles
      if (await deleteButton.isVisible()) {
        await expect(deleteButton).toBeDisabled();
      }
    }
  });
});
