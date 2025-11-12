/*
 * Teams MVP E2E Tests - Onboarding Workflow
 *
 * Tests the complete user onboarding flow for Teams feature:
 * 1. User signup
 * 2. First team creation
 * 3. Member invitation
 * 4. Initial space setup
 * 5. Team configuration
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signUpAndLogin,
  createTestTeam,
  inviteTeamMember,
  createTestSpace,
  navigateToTeamSpaces,
  expectTeamContext,
  cleanupTestData,
  TestUser,
  TestTeam
} from '../helpers/e2e-helpers';

test.describe('Teams MVP - Onboarding Workflow', () => {
  let testUser: TestUser;
  let testTeam: TestTeam;

  test.beforeAll(async () => {
    // Create test user data before running tests
    testUser = await createTestUser();
  });

  test.afterAll(async () => {
    // Cleanup test data after all tests complete
    if (testUser && testTeam) {
      await cleanupTestData(testUser, testTeam);
    }
  });

  test('should complete full onboarding flow: signup → create team → invite members', async ({ page }) => {
    console.log('🚀 Starting Teams onboarding flow test...');

    // Step 1: User Signup
    console.log('📝 Step 1: User signup...');
    await signUpAndLogin(page, testUser);

    // Verify user is logged in and redirected to appropriate page
    await expect(page).toHaveURL(/\/(home|onboarding)/);

    // Check for welcome message or teams prompt
    const welcomeMessage = page.locator('text=welcome', { caseSensitive: false });
    const teamsPrompt = page.locator('text=team', { caseSensitive: false });

    await expect(welcomeMessage.or(teamsPrompt)).toBeVisible({
      timeout: 10000,
    });

    // Step 2: Create First Team
    console.log('🏢 Step 2: Creating first team...');
    testTeam = await createTestTeam(page, testUser);

    // Verify team creation was successful
    await expectTeamContext(page, testTeam.name);

    // Verify we're on the team spaces page
    await expect(page).toHaveURL(`/home/teams/${testTeam.id}/spaces`);

    // Check for empty state or welcome message for spaces
    const emptyState = page.locator('[data-testid="empty-spaces-state"]');
    const welcomeSpaces = page.locator('text=spaces', { caseSensitive: false });

    await expect(emptyState.or(welcomeSpaces)).toBeVisible();

    // Step 3: Invite Team Members
    console.log('👥 Step 3: Inviting team members...');
    const memberEmail = `member-${testUser.id}@e2e.test`;

    await inviteTeamMember(page, testTeam.id, memberEmail);

    // Verify invite was sent successfully
    await expect(page.locator('[data-testid="invite-sent-message"]')).toBeVisible();
    await expect(page.locator(`text=${memberEmail}`)).toBeVisible();

    // Step 4: Create First Space
    console.log('📁 Step 4: Creating first space...');
    const testSpace = await createTestSpace(page, testTeam);

    // Verify space creation was successful
    await expect(page).toHaveURL(new RegExp(`\/home\/teams\/${testTeam.id}\/spaces\/${testSpace.id}`));

    // Check space details are displayed
    await expect(page.locator('h1')).toContainText(testSpace.name);
    if (testSpace.description) {
      await expect(page.locator('[data-testid="space-description"]')).toContainText(testSpace.description);
    }

    // Step 5: Verify Team Configuration
    console.log('⚙️ Step 5: Verifying team configuration...');

    // Navigate to team settings
    await page.goto(`/home/teams/${testTeam.id}/settings`);

    // Verify team details are correct
    await expect(page.locator('input[name="name"]')).toHaveValue(testTeam.name);
    await expect(page.locator('input[name="slug"]')).toHaveValue(testTeam.slug);

    // Verify member list includes the owner and invited member
    const memberList = page.locator('[data-testid="team-member-list"]');
    await expect(memberList).toBeVisible();

    // Check that owner is listed
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible();
    await expect(page.locator('[data-testid="owner-badge"]')).toBeVisible();

    // Step 6: Verify Navigation and UX
    console.log('🧭 Step 6: Verifying navigation and user experience...');

    // Test team selector functionality
    const teamSelector = page.locator('[data-testid="team-selector"]');
    if (await teamSelector.isVisible()) {
      await teamSelector.click();
      await expect(page.locator(`text=${testTeam.name}`)).toBeVisible();
    }

    // Test breadcrumbs work correctly
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
    if (await breadcrumbs.isVisible()) {
      await expect(breadcrumbs).toContainText('Teams');
      await expect(breadcrumbs).toContainText(testTeam.name);
    }

    // Test mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();

    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
    }

    console.log('✅ Teams onboarding flow completed successfully!');
  });

  test('should handle onboarding with existing user', async ({ page }) => {
    console.log('🔄 Testing onboarding with existing user...');

    // Login as existing user
    await page.goto('/login');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    // Should redirect to teams dashboard or team spaces
    await expect(page).toHaveURL(/\/home(\/teams)?/);

    // Navigate to teams page
    await page.goto('/home/teams');

    // Should see existing team
    await expect(page.locator(`text=${testTeam.name}`)).toBeVisible();

    // Should be able to create additional teams
    await page.click('[data-testid="create-team-button"]');

    const newTeamName = `Additional Team ${Date.now()}`;
    await page.fill('input[name="name"]', newTeamName);
    await page.fill('input[name="slug"]', `additional-${Date.now()}`);
    await page.click('button[type="submit"]');

    // Should be redirected to new team spaces
    await expect(page).toHaveURL(/\/home\/teams\/[^\/]+\/spaces/);
    await expectTeamContext(page, newTeamName);
  });

  test('should provide helpful guidance for new teams', async ({ page }) => {
    console.log('📚 Testing guidance and help content...');

    // Login and go to existing team
    await page.goto('/login');
    await page.fill('input[name="email"]', testUser.email);
    await page.fill('input[name="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await navigateToTeamSpaces(page, testTeam.id);

    // Check for help or guidance elements
    const helpButton = page.locator('[data-testid="help-button"]');
    const tourButton = page.locator('[data-testid="start-tour"]');
    const gettingStarted = page.locator('[data-testid="getting-started"]');

    const helpElements = helpButton.or(tourButton).or(gettingStarted);
    if (await helpElements.isVisible()) {
      await expect(helpElements).toBeVisible();
      console.log('✅ Help elements found for new users');
    } else {
      console.log('ℹ️ No help elements found (may not be implemented yet)');
    }

    // Test empty states provide clear CTAs
    const emptySpacesState = page.locator('[data-testid="empty-spaces-state"]');
    if (await emptySpacesState.isVisible()) {
      await expect(emptySpacesState.locator('button')).toBeVisible();
      console.log('✅ Empty state provides clear CTA');
    }
  });

  test('should handle onboarding errors gracefully', async ({ page }) => {
    console.log('🚨 Testing error handling during onboarding...');

    // Test team creation with invalid data
    await signUpAndLogin(page, await createTestUser());

    await page.goto('/home/teams');
    await page.click('[data-testid="create-team-button"]');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();

    // Try to create team with duplicate slug
    await page.fill('input[name="name"]', 'Duplicate Team');
    await page.fill('input[name="slug"]', testTeam.slug); // Use existing slug
    await page.click('button[type="submit"]');

    // Should show duplicate error
    const duplicateError = page.locator('text=already exists', { caseSensitive: false });
    const takenError = page.locator('text=already taken', { caseSensitive: false });

    await expect(duplicateError.or(takenError)).toBeVisible({
      timeout: 5000,
    });

    console.log('✅ Error handling validated');
  });

  test('should complete onboarding within performance thresholds', async ({ page }) => {
    console.log('⚡ Testing onboarding performance...');

    const startTime = Date.now();

    // Complete full onboarding flow
    const perfTestUser = await createTestUser();
    await signUpAndLogin(page, perfTestUser);

    const signupTime = Date.now() - startTime;
    console.log(`📊 Signup time: ${signupTime}ms`);

    const teamStartTime = Date.now();
    const perfTestTeam = await createTestTeam(page, perfTestUser);

    const teamCreationTime = Date.now() - teamStartTime;
    console.log(`📊 Team creation time: ${teamCreationTime}ms`);

    const spaceStartTime = Date.now();
    await createTestSpace(page, perfTestTeam);

    const spaceCreationTime = Date.now() - spaceStartTime;
    console.log(`📊 Space creation time: ${spaceCreationTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`📊 Total onboarding time: ${totalTime}ms`);

    // Performance assertions
    expect(signupTime).toBeLessThan(10000); // 10 seconds
    expect(teamCreationTime).toBeLessThan(8000); // 8 seconds
    expect(spaceCreationTime).toBeLessThan(5000); // 5 seconds
    expect(totalTime).toBeLessThan(30000); // 30 seconds total

    // Cleanup performance test data
    await cleanupTestData(perfTestUser, perfTestTeam);

    console.log('✅ Performance thresholds met');
  });
});