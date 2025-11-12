/*
 * E2E Test Helpers
 *
 * Shared utilities for End-to-End tests requiring real browser automation,
 * user authentication, team setup, and test data management.
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
}

export interface TestTeam {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
}

export interface TestSpace {
  id: string;
  name: string;
  teamId: string;
  description?: string;
}

export interface E2ETestFixture {
  authenticatedPage: Page;
  testUser: TestUser;
  testTeam: TestTeam;
  testSpace: TestSpace;
  cleanup: () => Promise<void>;
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Extended test fixture with authentication and test data setup
 */
export const test = base.extend<E2ETestFixture>({
  authenticatedPage: async ({ page, context }, use) => {
    const testUser = await createTestUser();
    await signUpAndLogin(page, testUser);
    await use(page);
  },

  testUser: async ({}, use) => {
    const testUser = await createTestUser();
    await use(testUser);
  },

  testTeam: async ({ authenticatedPage, testUser }, use) => {
    const testTeam = await createTestTeam(authenticatedPage, testUser);
    await use(testTeam);
  },

  testSpace: async ({ authenticatedPage, testTeam }, use) => {
    const testSpace = await createTestSpace(authenticatedPage, testTeam);
    await use(testSpace);
  },

  cleanup: async ({ context }, use) => {
    const cleanupData: Array<() => Promise<void>> = [];

    await use(async () => {
      // Run all cleanup functions
      for (const cleanupFn of cleanupData) {
        try {
          await cleanupFn();
        } catch (error) {
          console.warn('Cleanup function failed:', error);
        }
      }

      // Clear all cookies and storage
      await context.clearCookies();
      await context.clearPermissions();
    });
  }
});

export { expect };

// ============================================================================
// USER MANAGEMENT HELPERS
// ============================================================================

/**
 * Create a test user with random data
 */
export async function createTestUser(): Promise<TestUser> {
  const uuid = randomUUID().split('-')[0];
  return {
    id: `user_test_${uuid}`,
    email: `test-${uuid}@e2e.test`,
    name: `Test User ${uuid}`,
    password: `TestPassword123!${uuid}`,
  };
}

/**
 * Sign up a new user and login
 */
export async function signUpAndLogin(page: Page, user: TestUser): Promise<void> {
  try {
    // Go to signup page
    await page.goto('/signup');

    // Fill signup form
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="name"]', user.name);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);

    // Submit signup form
    await page.click('button[type="submit"]');

    // Wait for successful signup - redirect to dashboard or onboarding
    await expect(page).toHaveURL(/\/(home|onboarding)/);

    console.log(`✅ User signed up successfully: ${user.email}`);
  } catch (error) {
    // If signup fails, try to login directly (user might already exist)
    console.log('Signup failed, trying login...');
    await login(page, user);
  }
}

/**
 * Login with existing user
 */
export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');

  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);

  await page.click('button[type="submit"]');

  // Wait for successful login
  await expect(page).toHaveURL(/\/home/);

  console.log(`✅ User logged in successfully: ${user.email}`);
}

// ============================================================================
// TEAM MANAGEMENT HELPERS
// ============================================================================

/**
 * Create a test team through UI
 */
export async function createTestTeam(page: Page, user: TestUser): Promise<TestTeam> {
  const teamId = `team_test_${randomUUID().split('-')[0]}`;
  const teamName = `E2E Test Team ${teamId}`;

  try {
    // Navigate to teams page
    await page.goto('/home/teams');

    // Click create team button
    await page.click('[data-testid="create-team-button"]');

    // Fill team creation form
    await page.fill('input[name="name"]', teamName);
    await page.fill('input[name="slug"]', teamId);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to team spaces page
    await expect(page).toHaveURL(`/home/teams/${teamId}/spaces`);

    const testTeam: TestTeam = {
      id: teamId,
      name: teamName,
      slug: teamId,
      ownerId: user.id,
    };

    console.log(`✅ Team created successfully: ${teamName}`);
    return testTeam;

  } catch (error) {
    console.error('Failed to create team:', error);
    throw error;
  }
}

/**
 * Invite a member to the team
 */
export async function inviteTeamMember(page: Page, teamId: string, memberEmail: string): Promise<void> {
  try {
    // Navigate to team settings or members page
    await page.goto(`/home/teams/${teamId}/settings`);

    // Click invite members button
    await page.click('[data-testid="invite-members-button"]');

    // Fill member email
    await page.fill('input[name="email"]', memberEmail);

    // Send invite
    await page.click('button[type="submit"]');

    // Verify invite was sent
    await expect(page.locator('[data-testid="invite-sent-message"]')).toBeVisible();

    console.log(`✅ Team member invited: ${memberEmail}`);

  } catch (error) {
    console.error('Failed to invite team member:', error);
    throw error;
  }
}

// ============================================================================
// SPACE MANAGEMENT HELPERS
// ============================================================================

/**
 * Create a test space within a team
 */
export async function createTestSpace(page: Page, team: TestTeam): Promise<TestSpace> {
  const spaceId = `space_test_${randomUUID().split('-')[0]}`;
  const spaceName = `E2E Test Space ${spaceId}`;

  try {
    // Navigate to team spaces page
    await page.goto(`/home/teams/${team.id}/spaces`);

    // Click create space button
    await page.click('[data-testid="create-space-button"]');

    // Fill space creation form
    await page.fill('input[name="name"]', spaceName);
    await page.fill('textarea[name="description"]', `E2E test space for ${team.name}`);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to space page
    await expect(page).toHaveURL(/\/home\/teams\/${team.id}\/spaces\/${spaceId}/);

    const testSpace: TestSpace = {
      id: spaceId,
      name: spaceName,
      teamId: team.id,
      description: `E2E test space for ${team.name}`,
    };

    console.log(`✅ Space created successfully: ${spaceName}`);
    return testSpace;

  } catch (error) {
    console.error('Failed to create space:', error);
    throw error;
  }
}

// ============================================================================
// NAVIGATION AND INTERACTION HELPERS
// ============================================================================

/**
 * Navigate to team spaces page with error handling
 */
export async function navigateToTeamSpaces(page: Page, teamId: string): Promise<void> {
  await page.goto(`/home/teams/${teamId}/spaces`);

  // Handle potential permission errors
  const errorMessage = page.locator('[data-testid="error-message"]');
  if (await errorMessage.isVisible({ timeout: 5000 })) {
    throw new Error(`Permission denied for team ${teamId}: ${await errorMessage.textContent()}`);
  }
}

/**
 * Wait for page to be fully loaded with teams context
 */
export async function waitForTeamsContext(page: Page): Promise<void> {
  // Wait for team selector or team name to be visible
  await Promise.race([
    page.waitForSelector('[data-testid="team-selector"]'),
    page.waitForSelector('[data-testid="current-team-name"]'),
    page.waitForSelector('[data-testid="teams-header"]'),
  ]);

  // Wait for any loading states to resolve
  await page.waitForLoadState('networkidle');
}

/**
 * Perform search with team filtering
 */
export async function performTeamSearch(page: Page, query: string, teamId?: string): Promise<void> {
  // Navigate to search page if not already there
  if (!page.url().includes('/search')) {
    await page.goto('/home/search');
  }

  // Fill search query
  await page.fill('input[placeholder*="search" i]', query);

  // Set team filter if provided
  if (teamId) {
    await page.selectOption('[data-testid="team-filter"]', teamId);
  }

  // Submit search
  await page.press('input[placeholder*="search" i]', 'Enter');

  // Wait for results
  await page.waitForSelector('[data-testid="search-results"]');
}

// ============================================================================
// CLEANUP HELPERS
// ============================================================================

/**
 * Clean up test data via API calls
 */
export async function cleanupTestData(user: TestUser, team?: TestTeam, space?: TestSpace): Promise<void> {
  const cleanupPromises: Promise<void>[] = [];

  // Note: In a real implementation, these would be API calls to delete test data
  // For now, we just log what would be cleaned up

  if (space) {
    console.log(`🧹 Cleaning up space: ${space.name}`);
    // await deleteSpace(space.id);
  }

  if (team) {
    console.log(`🧹 Cleaning up team: ${team.name}`);
    // await deleteTeam(team.id);
  }

  if (user) {
    console.log(`🧹 Cleaning up user: ${user.email}`);
    // await deleteUser(user.id);
  }

  await Promise.allSettled(cleanupPromises);
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that page shows team context correctly
 */
export async function expectTeamContext(page: Page, teamName: string): Promise<void> {
  await expect(page.locator('[data-testid="current-team-name"]')).toContainText(teamName);
}

/**
 * Assert that user has proper permissions for team
 */
export async function expectTeamPermissions(page: Page, teamId: string, canEdit: boolean = true): Promise<void> {
  await navigateToTeamSpaces(page, teamId);

  if (canEdit) {
    await expect(page.locator('[data-testid="create-space-button"]')).toBeVisible();
  } else {
    await expect(page.locator('[data-testid="create-space-button"]')).not.toBeVisible();
  }
}

/**
 * Assert that search respects team boundaries
 */
export async function expectSearchTeamBoundaries(page: Page, teamId: string, expectedResults: number): Promise<void> {
  await performTeamSearch(page, 'test', teamId);

  const results = page.locator('[data-testid="search-result-item"]');
  await expect(results).toHaveCount(expectedResults);

  // Verify all results belong to the specified team
  const resultCount = await results.count();
  for (let i = 0; i < resultCount; i++) {
    const result = results.nth(i);
    await expect(result).toContainText(teamId);
  }
}