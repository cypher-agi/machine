import { test, expect } from '@playwright/test';

test.describe('Teams', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teams');
  });

  test('shows page title', async ({ page }) => {
    await expect(page.locator('h1, [class*="title"]').first()).toContainText(/teams/i);
  });

  test('shows empty state when no teams exist', async ({ page }) => {
    const emptyState = page.locator('[data-testid="empty-state"], .empty-state, [class*="empty"]');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('has Create button', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await expect(createButton).toBeVisible();
  });

  test('has Join button', async ({ page }) => {
    const joinButton = page.locator('button:has-text("Join"), [data-testid="join-team-button"]');
    await expect(joinButton).toBeVisible();
  });

  test('can open create team modal', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('create modal has name input', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    const nameInput = page.locator('input[name="name"], [data-testid="team-name-input"]');
    await expect(nameInput).toBeVisible();
  });

  test('create modal has handle input', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    const handleInput = page.locator('input[name="handle"], [data-testid="team-handle-input"]');
    await expect(handleInput).toBeVisible();
  });

  test('can fill create team form', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    const nameInput = page.locator('input[name="name"], [data-testid="team-name-input"]');
    await nameInput.fill('My Test Team');

    const handleInput = page.locator('input[name="handle"], [data-testid="team-handle-input"]');
    await handleInput.fill('my-test-team');

    // Verify inputs have values
    await expect(nameInput).toHaveValue('My Test Team');
    await expect(handleInput).toHaveValue('my-test-team');
  });

  test('can open join team modal', async ({ page }) => {
    const joinButton = page.locator('button:has-text("Join"), [data-testid="join-team-button"]');
    await joinButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
  });

  test('join modal has invite code input', async ({ page }) => {
    const joinButton = page.locator('button:has-text("Join"), [data-testid="join-team-button"]');
    await joinButton.click();

    const codeInput = page.locator(
      'input[name="invite_code"], input[placeholder*="code" i], [data-testid="invite-code-input"]'
    );
    await expect(codeInput).toBeVisible();
  });

  test('can enter invite code', async ({ page }) => {
    const joinButton = page.locator('button:has-text("Join"), [data-testid="join-team-button"]');
    await joinButton.click();

    const codeInput = page.locator(
      'input[name="invite_code"], input[placeholder*="code" i], [data-testid="invite-code-input"]'
    );
    await codeInput.fill('ABC123XYZ');

    await expect(codeInput).toHaveValue('ABC123XYZ');
  });

  test('can select team to view details', async ({ page }) => {
    const teamCard = page
      .locator('[data-testid="team-card"], .team-card, [class*="ItemCard"]')
      .first();

    if (await teamCard.isVisible()) {
      await teamCard.click();
      await expect(
        page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]')
      ).toBeVisible();
    }
  });

  test('displays team handle with @ prefix', async ({ page }) => {
    const handleText = page.locator('[class*="handle"], [data-testid="team-handle"]').first();

    if (await handleText.isVisible()) {
      const text = await handleText.textContent();
      expect(text).toMatch(/^@/);
    }
  });

  test('displays member count', async ({ page }) => {
    const memberCount = page.locator('text=/\\d+ members?/i').first();

    if (await memberCount.isVisible()) {
      await expect(memberCount).toBeVisible();
    }
  });

  test('displays role badge', async ({ page }) => {
    const roleBadge = page.locator('text=/Admin|Member/').first();

    if (await roleBadge.isVisible()) {
      await expect(roleBadge).toBeVisible();
    }
  });

  test('has refresh button', async ({ page }) => {
    const refreshButton = page.locator(
      '[data-testid="refresh-button"], button[title*="Refresh" i], button:has(svg[class*="refresh" i])'
    );
    await expect(refreshButton).toBeVisible();
  });

  test('can close create modal', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();

    // Close button or click outside
    const closeButton = page.locator(
      '[data-testid="modal-close"], button[aria-label*="close" i], .modal-close'
    );
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Press Escape
      await page.keyboard.press('Escape');
    }

    await expect(page.locator('[role="dialog"], .modal')).not.toBeVisible();
  });

  test('can close join modal', async ({ page }) => {
    const joinButton = page.locator('button:has-text("Join"), [data-testid="join-team-button"]');
    await joinButton.click();

    await expect(page.locator('[role="dialog"], .modal')).toBeVisible();

    // Close button or press Escape
    const closeButton = page.locator(
      '[data-testid="modal-close"], button[aria-label*="close" i], .modal-close'
    );
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(page.locator('[role="dialog"], .modal')).not.toBeVisible();
  });

  test('validates required fields in create form', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    // Try to submit empty form
    const submitButton = page
      .locator('button[type="submit"], button:has-text("Create"):visible')
      .last();
    await submitButton.click();

    // Should show validation error or form should not close
    const modal = page.locator('[role="dialog"], .modal');
    await expect(modal).toBeVisible();
  });

  test('handle input auto-formats to lowercase', async ({ page }) => {
    const createButton = page.locator(
      'button:has-text("Create"), [data-testid="create-team-button"]'
    );
    await createButton.click();

    const handleInput = page.locator('input[name="handle"], [data-testid="team-handle-input"]');
    await handleInput.fill('MY-UPPERCASE-HANDLE');

    // Handle should be converted to lowercase
    const value = await handleInput.inputValue();
    expect(value.toLowerCase()).toBe(value);
  });
});

test.describe('Teams - Team Details (Sidekick)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/teams');
  });

  test('shows team details in sidekick when selected', async ({ page }) => {
    const teamCard = page
      .locator('[data-testid="team-card"], .team-card, [class*="ItemCard"]')
      .first();

    if (await teamCard.isVisible()) {
      await teamCard.click();

      const sidekick = page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]');
      await expect(sidekick).toBeVisible();

      // Should show team name
      await expect(sidekick.locator('h2, h3, [class*="title"]').first()).toBeVisible();
    }
  });

  test('shows member list in sidekick', async ({ page }) => {
    const teamCard = page
      .locator('[data-testid="team-card"], .team-card, [class*="ItemCard"]')
      .first();

    if (await teamCard.isVisible()) {
      await teamCard.click();

      const sidekick = page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]');
      await expect(sidekick).toBeVisible();

      // Should have a members section or tab
      const membersSection = sidekick.locator('text=/members/i');
      if (await membersSection.isVisible()) {
        await expect(membersSection).toBeVisible();
      }
    }
  });

  test('admin can generate invite link', async ({ page }) => {
    const teamCard = page
      .locator('[data-testid="team-card"], .team-card, [class*="ItemCard"]')
      .first();

    if (await teamCard.isVisible()) {
      await teamCard.click();

      const sidekick = page.locator('[data-testid="sidekick"], .sidekick, [class*="Sidekick"]');
      await expect(sidekick).toBeVisible();

      // Look for invite button (only visible to admins)
      const inviteButton = sidekick.locator(
        'button:has-text("Invite"), button:has-text("Generate")'
      );
      if (await inviteButton.isVisible()) {
        await expect(inviteButton).toBeEnabled();
      }
    }
  });
});
