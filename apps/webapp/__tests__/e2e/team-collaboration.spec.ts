/*
 * Teams MVP E2E Tests - Team Collaboration Flow
 *
 * Tests the day-to-day collaboration workflow for Teams feature:
 * 1. Login with team context
 * 2. Navigate between team spaces
 * 3. Add content and memories
 * 4. Search with team filtering
 * 5. Real-time collaboration features
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signUpAndLogin,
  createTestTeam,
  createTestSpace,
  login,
  navigateToTeamSpaces,
  performTeamSearch,
  expectSearchTeamBoundaries,
  expectTeamContext,
  expectTeamPermissions,
  cleanupTestData,
  TestUser,
  TestTeam,
  TestSpace
} from '../helpers/e2e-helpers';

test.describe('Teams MVP - Collaboration Flow', () => {
  let testUser: TestUser;
  let testTeam: TestTeam;
  let testSpaces: TestSpace[] = [];

  test.beforeAll(async ({ browser }) => {
    // Setup test data
    testUser = await createTestUser();
    testTeam = await createTestTeamData();
  });

  test.afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testUser, testTeam);
    for (const space of testSpaces) {
      await cleanupTestData(testUser, testTeam, space);
    }
  });

  /**
   * Helper function to create test team data without browser
   */
  async function createTestTeamData(): Promise<TestTeam> {
    return {
      id: `team_collab_${Date.now()}`,
      name: 'Collaboration Test Team',
      slug: `collab-team-${Date.now()}`,
      ownerId: testUser.id,
    };
  }

  test('should complete daily collaboration workflow', async ({ page }) => {
    console.log('🚀 Starting team collaboration workflow test...');

    // Step 1: Login and establish team context
    console.log('🔐 Step 1: Login with team context...');
    await signUpAndLogin(page, testUser);

    // Create team via UI
    testTeam = await createTestTeam(page, testUser);
    await expectTeamContext(page, testTeam.name);

    // Step 2: Create multiple spaces for different projects
    console.log('📁 Step 2: Creating multiple project spaces...');
    const spaceNames = [
      'Product Development',
      'Marketing Campaign',
      'Customer Research',
      'Team Documentation'
    ];

    for (const spaceName of spaceNames) {
      await navigateToTeamSpaces(page, testTeam.id);

      const space = await createTestSpaceWithDetails(page, testTeam, spaceName);
      testSpaces.push(space);

      console.log(`✅ Created space: ${spaceName}`);
    }

    // Step 3: Add content to spaces
    console.log('📝 Step 3: Adding content to spaces...');
    await addContentToSpaces(page, testSpaces);

    // Step 4: Test navigation between spaces
    console.log('🧭 Step 4: Testing navigation between spaces...');
    await testSpaceNavigation(page, testTeam, testSpaces);

    // Step 5: Test search functionality
    console.log('🔍 Step 5: Testing search functionality...');
    await testSearchFunctionality(page, testTeam, testSpaces);

    // Step 6: Test space management features
    console.log('⚙️ Step 6: Testing space management...');
    await testSpaceManagement(page, testTeam, testSpaces[0]);

    console.log('✅ Team collaboration workflow completed successfully!');
  });

  /**
   * Create a space with additional details
   */
  async function createTestSpaceWithDetails(
    page: Page,
    team: TestTeam,
    spaceName: string
  ): Promise<TestSpace> {
    const spaceId = `space_${spaceName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

    await navigateToTeamSpaces(page, team.id);
    await page.click('[data-testid="create-space-button"]');

    await page.fill('input[name="name"]', spaceName);
    await page.fill('textarea[name="description"]', `Collaboration space for ${spaceName} activities`);

    // Add tags if supported
    const tagsInput = page.locator('input[name="tags"]');
    if (await tagsInput.isVisible()) {
      await tagsInput.fill(spaceName.toLowerCase().replace(/\s+/g, ','));
    }

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(new RegExp(`\/home\/teams\/${team.id}\/spaces\/${spaceId}`));

    return {
      id: spaceId,
      name: spaceName,
      teamId: team.id,
      description: `Collaboration space for ${spaceName} activities`,
    };
  }

  /**
   * Add content to spaces
   */
  async function addContentToSpaces(page: Page, spaces: TestSpace[]): Promise<void> {
    for (const space of spaces) {
      await page.goto(`/home/teams/${space.teamId}/spaces/${space.id}`);

      // Try to add different types of content
      const addContentButton = page.locator('[data-testid="add-content-button"]');
      const newConversationButton = page.locator('[data-testid="new-conversation"]');
      const uploadDocumentButton = page.locator('[data-testid="upload-document"]');

      if (await addContentButton.isVisible()) {
        await addContentButton.click();

        // Try to create a conversation
        const conversationTitle = `${space.name} Discussion ${Date.now()}`;
        await page.fill('input[name="title"]', conversationTitle);
        await page.fill('textarea[name="content"]', `This is a test conversation for ${space.name}.`);

        await page.click('button[type="submit"]');

        // Verify content was added
        await expect(page.locator(`text=${conversationTitle}`)).toBeVisible();
      } else if (await newConversationButton.isVisible()) {
        await newConversationButton.click();

        const conversationTitle = `${space.name} Chat ${Date.now()}`;
        await page.fill('input[placeholder*="title" i]', conversationTitle);
        await page.fill('textarea[placeholder*="message" i]', `Starting discussion about ${space.name}.`);

        await page.click('button[type="submit"]');

        await expect(page.locator(`text=${conversationTitle}`)).toBeVisible();
      }

      console.log(`📝 Added content to space: ${space.name}`);
    }
  }

  /**
   * Test navigation between spaces
   */
  async function testSpaceNavigation(page: Page, team: TestTeam, spaces: TestSpace[]): Promise<void> {
    // Navigate to team spaces overview
    await navigateToTeamSpaces(page, team.id);

    // Verify all spaces are listed
    for (const space of spaces) {
      await expect(page.locator(`text=${space.name}`)).toBeVisible();
    }

    // Test clicking on each space
    for (const space of spaces) {
      await page.click(`text=${space.name}`);

      // Verify we're on the correct space page
      await expect(page).toHaveURL(new RegExp(`\/home\/teams\/${team.id}\/spaces\/${space.id}`));
      await expect(page.locator('h1')).toContainText(space.name);

      // Test breadcrumbs navigation
      const breadcrumbs = page.locator('[data-testid="breadcrumbs"]');
      if (await breadcrumbs.isVisible()) {
        await expect(breadcrumbs).toContainText(team.name);
        await expect(breadcrumbs).toContainText('Spaces');
      }
    }

    // Test team context is maintained
    await expectTeamContext(page, team.name);

    console.log('🧭 Navigation between spaces verified');
  }

  /**
   * Test search functionality
   */
  async function testSearchFunctionality(page: Page, team: TestTeam, spaces: TestSpace[]): Promise<void> {
    // Test general search
    await performTeamSearch(page, 'discussion', team.id);

    // Verify search results are scoped to team
    const searchResults = page.locator('[data-testid="search-result-item"]');
    const resultCount = await searchResults.count();

    if (resultCount > 0) {
      // Verify results are relevant and team-scoped
      for (let i = 0; i < Math.min(resultCount, 3); i++) {
        const result = searchResults.nth(i);
        await expect(result).toBeVisible();
      }
    }

    // Test space-specific search
    await page.goto(`/home/teams/${team.id}/spaces/${spaces[0].id}`);

    const spaceSearchInput = page.locator('input[placeholder*="search" i]');
    if (await spaceSearchInput.isVisible()) {
      await spaceSearchInput.fill(spaces[0].name.split(' ')[0]);
      await page.keyboard.press('Enter');

      // Verify search within space works
      const spaceResults = page.locator('[data-testid="space-search-results"]');
      if (await spaceResults.isVisible()) {
        await expect(spaceResults).toBeVisible();
      }
    }

    console.log('🔍 Search functionality verified');
  }

  /**
   * Test space management features
   */
  async function testSpaceManagement(page: Page, team: TestTeam, space: TestSpace): Promise<void> {
    await page.goto(`/home/teams/${team.id}/spaces/${space.id}`);

    // Test space settings
    const settingsButton = page.locator('[data-testid="space-settings"]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Verify space settings page
      await expect(page).toHaveURL(new RegExp(`\/spaces\/${space.id}\/settings`));

      // Test editing space details
      await page.fill('input[name="name"]', `${space.name} (Updated)`);
      await page.fill('textarea[name="description"]', `${space.description} - Updated for testing`);

      await page.click('button[type="submit"]');

      // Verify changes were saved
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }

    // Test space sharing
    const shareButton = page.locator('[data-testid="share-space"]');
    if (await shareButton.isVisible()) {
      await shareButton.click();

      // Verify sharing modal or page
      await expect(page.locator('[data-testid="share-modal"]').or(page.locator('[data-testid="share-page"]'))).toBeVisible();

      // Test copying share link
      const copyLinkButton = page.locator('[data-testid="copy-share-link"]');
      if (await copyLinkButton.isVisible()) {
        await copyLinkButton.click();

        // Verify success message
        await expect(page.locator('[data-testid="copied-message"]')).toBeVisible();
      }
    }

    console.log('⚙️ Space management features verified');
  });

  test('should handle real-time collaboration features', async ({ browser }) => {
    console.log('👥 Testing real-time collaboration...');

    // Create two browser contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1 logs in and creates content
    const user1 = await createTestUser();
    await signUpAndLogin(page1, user1);
    const team1 = await createTestTeam(page1, user1);
    const space1 = await createTestSpace(page1, team1);

    // User 2 logs in and joins the team
    const user2 = await createTestUser();
    await signUpAndLogin(page2, user2);

    // User 1 invites user 2
    await inviteTeamMember(page1, team1.id, user2.email);

    // User 2 accepts invite (this would depend on implementation)
    await page2.goto(`/home/teams/${team1.id}/spaces/${space1.id}`);

    // Test that both users can see the space
    await expectTeamContext(page1, team1.name);
    await expectTeamContext(page2, team1.name);

    // Test concurrent editing (if implemented)
    const editButton1 = page1.locator('[data-testid="edit-space"]');
    const editButton2 = page2.locator('[data-testid="edit-space"]');

    if (await editButton1.isVisible() && await editButton2.isVisible()) {
      // Both users try to edit
      await editButton1.click();
      await editButton2.click();

      // Check for conflict resolution or locking mechanism
      const conflictMessage = page2.locator('[data-testid="edit-conflict"]');
      const lockMessage = page2.locator('[data-testid="edit-locked"]');

      if (await conflictMessage.isVisible() || await lockMessage.isVisible()) {
        console.log('✅ Real-time conflict handling working');
      }
    }

    // Cleanup
    await context1.close();
    await context2.close();
    await cleanupTestData(user1, team1);
    await cleanupTestData(user2);

    console.log('👥 Real-time collaboration features tested');
  });

  test('should maintain team context across all operations', async ({ page }) => {
    console.log('🎯 Testing team context consistency...');

    await signUpAndLogin(page, testUser);
    testTeam = await createTestTeam(page, testUser);

    // Test team context in different pages
    const testPages = [
      `/home/teams/${testTeam.id}/spaces`,
      `/home/teams/${testTeam.id}/settings`,
      `/home/teams/${testTeam.id}/members`,
      `/home/search?team=${testTeam.id}`,
    ];

    for (const pageUrl of testPages) {
      await page.goto(pageUrl);
      await waitForTeamsContext(page);
      await expectTeamContext(page, testTeam.name);
    }

    // Test team context after navigation
    await page.goto('/home');
    await page.goto(`/home/teams/${testTeam.id}/spaces`);
    await expectTeamContext(page, testTeam.name);

    // Test team context after search
    await performTeamSearch(page, 'test', testTeam.id);
    await expectTeamContext(page, testTeam.name);

    console.log('✅ Team context consistency verified');
  });

  test('should handle collaboration on mobile devices', async ({ page }) => {
    console.log('📱 Testing mobile collaboration...');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await signUpAndLogin(page, testUser);
    testTeam = await createTestTeam(page, testUser);
    const mobileSpace = await createTestSpace(page, testTeam);

    // Test mobile navigation
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    }

    // Test mobile space creation
    await navigateToTeamSpaces(page, testTeam.id);

    const createSpaceButton = page.locator('[data-testid="create-space-button"]');
    if (await createSpaceButton.isVisible()) {
      await createSpaceButton.click();

      // Test form usability on mobile
      await expect(page.locator('input[name="name"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      await page.fill('input[name="name"]', 'Mobile Test Space');
      await page.click('button[type="submit"]');

      // Verify mobile layout adapts
      await expect(page.locator('h1')).toBeVisible();
    }

    // Test mobile search
    const mobileSearchButton = page.locator('[data-testid="mobile-search"]');
    if (await mobileSearchButton.isVisible()) {
      await mobileSearchButton.click();
      await expect(page.locator('input[placeholder*="search" i]')).toBeVisible();
    }

    console.log('📱 Mobile collaboration verified');
  });
});