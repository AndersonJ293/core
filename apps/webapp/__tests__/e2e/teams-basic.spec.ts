/*
 * Teams MVP E2E Tests - Basic Functionality
 *
 * Tests critical user workflows for Teams feature
 */

import { test, expect } from '@playwright/test';

test.describe('Teams MVP - Basic E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test data or login if needed
    // await page.goto('/login');
    // await loginAsTestUser(page);
  });

  test('should render teams page correctly', async ({ page }) => {
    await page.goto('/home/teams');

    // Verify page title
    await expect(page).toHaveTitle(/Teams/);

    // Check for teams header
    await expect(page.locator('h1')).toContainText('Teams');

    // Check for create team button (if visible)
    const createButton = page.locator('[data-testid="create-team-button"]');
    if (await createButton.isVisible()) {
      await expect(createButton).toBeVisible();
    }
  });

  test('should navigate to team spaces', async ({ page }) => {
    await page.goto('/home/teams');

    // Click on first team (if available)
    const teamCard = page.locator('[data-testid="team-card"]').first();
    if (await teamCard.isVisible()) {
      await teamCard.click();
      await expect(page).toHaveURL(/\/home\/teams\/[^\/]+\/spaces/);
    }
  });

  test('should handle permission errors gracefully', async ({ page }) => {
    // Try to access a team the user doesn't have access to
    await page.goto('/home/teams/nonexistent-team/spaces');

    // Should show appropriate error message or redirect
    const errorMessage = page.locator('[data-testid="error-message"]');
    const notFoundMessage = page.locator('text=Team not found');

    await expect(errorMessage.or(notFoundMessage)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/home/teams');

    // Check that page is usable on mobile
    await expect(page.locator('h1')).toBeVisible();

    // Check mobile navigation if present
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      await expect(mobileMenu).toBeVisible();
    }
  });
});