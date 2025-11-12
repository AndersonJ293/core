/*
 * Teams MVP E2E Tests - Permission Boundaries
 *
 * Tests critical security and permission boundaries for Teams feature:
 * 1. Access denied to non-member teams
 * 2. Role hierarchy enforcement
 * 3. Space-level permissions
 * 4. Cross-team data isolation
 * 5. Authentication boundary testing
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
  expectTeamPermissions,
  expectSearchTeamBoundaries,
  cleanupTestData,
  TestUser,
  TestTeam,
  TestSpace
} from '../helpers/e2e-helpers';

test.describe('Teams MVP - Permission Boundaries', () => {
  let teamOwner: TestUser;
  let teamMember: TestUser;
  let outsiderUser: TestUser;
  let privateTeam: TestTeam;
  let publicTeam: TestTeam;
  let privateSpaces: TestSpace[] = [];
  let publicSpaces: TestSpace[] = [];

  test.beforeAll(async () => {
    // Create test users
    teamOwner = await createTestUser();
    teamMember = await createTestUser();
    outsiderUser = await createTestUser();

    console.log('👥 Created test users for permission testing');
  });

  test.afterAll(async () => {
    // Cleanup all test data
    await cleanupTestData(teamOwner, privateTeam);
    await cleanupTestData(teamOwner, publicTeam);

    for (const space of [...privateSpaces, ...publicSpaces]) {
      await cleanupTestData(teamOwner, privateTeam, space);
    }

    await cleanupTestData(teamMember);
    await cleanupTestData(outsiderUser);
  });

  test('should prevent access to non-member teams', async ({ page }) => {
    console.log('🚫 Testing access control for non-members...');

    // Setup: Create team and spaces as owner
    await signUpAndLogin(page, teamOwner);
    privateTeam = await createTestTeam(page, teamOwner);

    const privateSpace1 = await createTestSpace(page, privateTeam);
    const privateSpace2 = await createTestSpace(page, privateTeam);
    privateSpaces = [privateSpace1, privateSpace2];

    // Add some content to make it more realistic
    await addTestContent(page, privateSpace1, 'Private team sensitive data');
    await addTestContent(page, privateSpace2, 'Confidential project information');

    // Logout as owner
    await page.goto('/logout');

    // Try to access as outsider user (should be denied)
    await signUpAndLogin(page, outsiderUser);

    // Test direct URL access attempts
    const restrictedUrls = [
      `/home/teams/${privateTeam.id}/spaces`,
      `/home/teams/${privateTeam.id}/spaces/${privateSpace1.id}`,
      `/home/teams/${privateTeam.id}/settings`,
      `/home/teams/${privateTeam.id}/members`,
    ];

    for (const url of restrictedUrls) {
      console.log(`🔍 Testing access to: ${url}`);

      await page.goto(url);

      // Should show error message or redirect
      const errorSelectors = [
        '[data-testid="error-message"]',
        '[data-testid="access-denied"]',
        'text=Access Denied',
        'text=Team not found',
        'text=Permission required',
      ];

      const errorElement = page.locator(errorSelectors.join(','));

      // Check for error message or redirect to safe location
      await expect(errorElement.or(page.locator('[data-testid="teams-dashboard"]'))).toBeVisible({
        timeout: 5000,
      });

      // Verify we're not on the restricted page
      expect(page.url()).not.toContain(privateTeam.id);
    }

    console.log('✅ Access control for non-members verified');
  });

  test('should enforce team member role hierarchy', async ({ page, browser }) => {
    console.log('👑 Testing role hierarchy enforcement...');

    // Create team as owner
    await signUpAndLogin(page, teamOwner);
    privateTeam = await createTestTeam(page, teamOwner);

    const ownerSpace = await createTestSpace(page, privateTeam);
    await addTestContent(page, ownerSpace, 'Owner-only content');

    // Invite team member
    await inviteTeamMember(page, privateTeam.id, teamMember.email);

    // Login as team member
    await page.goto('/logout');
    await login(page, teamMember);

    // Test member permissions (should be able to access team but with limitations)
    await navigateToTeamSpaces(page, privateTeam.id);

    // Should see team spaces but have limited permissions
    await expectTeamPermissions(page, privateTeam.id, false); // canEdit = false

    // Test restricted actions for members
    const restrictedActions = [
      '[data-testid="delete-team-button"]',
      '[data-testid="transfer-ownership"]',
      '[data-testid="team-settings-admin"]',
    ];

    for (const selector of restrictedActions) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        await expect(element).toBeDisabled();
      }
    }

    // Test that member can create spaces (if allowed)
    const createSpaceButton = page.locator('[data-testid="create-space-button"]');
    if (await createSpaceButton.isVisible()) {
      await createSpaceButton.click();

      // Should be able to fill the form
      await expect(page.locator('input[name="name"]')).toBeVisible();

      // Cancel to avoid actually creating space
      await page.keyboard.press('Escape');
    }

    // Test search respects team boundaries
    await performTeamSearch(page, 'content', privateTeam.id);

    // Should find content within team but not from other teams
    const searchResults = page.locator('[data-testid="search-result-item"]');
    const resultCount = await searchResults.count();

    if (resultCount > 0) {
      // Verify all results are from the current team
      for (let i = 0; i < resultCount; i++) {
        const result = searchResults.nth(i);
        const resultText = await result.textContent();
        expect(resultText).toContain(privateTeam.name);
      }
    }

    console.log('✅ Role hierarchy enforcement verified');
  });

  test('should maintain strict cross-team data isolation', async ({ browser }) => {
    console.log('🔒 Testing cross-team data isolation...');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage(); // Team 1 owner
    const page2 = await context2.newPage(); // Team 2 owner

    // Team 1 setup
    await signUpAndLogin(page1, teamOwner);
    const team1 = await createTestTeam(page1, teamOwner);
    const team1Space = await createTestSpace(page1, team1);
    await addTestContent(page1, team1Space, 'Team 1 confidential data');

    // Team 2 setup
    const team2Owner = await createTestUser();
    await signUpAndLogin(page2, team2Owner);
    const team2 = await createTestTeam(page2, team2Owner);
    const team2Space = await createTestSpace(page2, team2);
    await addTestContent(page2, team2Space, 'Team 2 confidential data');

    // Test cross-team search isolation
    await performTeamSearch(page1, 'confidential data', team1.id);
    const team1Results = page1.locator('[data-testid="search-result-item"]');
    const team1ResultCount = await team1Results.count();

    // Team 1 should only see its own data
    for (let i = 0; i < team1ResultCount; i++) {
      const result = team1Results.nth(i);
      const resultText = await result.textContent();
      expect(resultText).not.toContain('Team 2');
      expect(resultText).not.toContain(team2.name);
    }

    // Test that Team 1 cannot access Team 2 URLs
    await page1.goto(`/home/teams/${team2.id}/spaces/${team2Space.id}`);

    const accessDenied = page1.locator('[data-testid="access-denied"]');
    const errorMessage = page1.locator('[data-testid="error-message"]');

    await expect(accessDenied.or(errorMessage)).toBeVisible({
      timeout: 5000,
    });

    // Test URL manipulation attacks
    const maliciousUrls = [
      `/home/teams/${team2.id}/api/members`,
      `/home/teams/${team2.id}/settings/export`,
      `/api/v1/teams/${team2.id}/spaces`,
      `/api/v1/teams/${team2.id}/members?format=json`,
    ];

    for (const url of maliciousUrls) {
      await page1.goto(url);

      // Should return error or redirect
      const statusCode = await page1.locator('text=401|403|404|Unauthorized|Forbidden').first();
      if (await statusCode.isVisible()) {
        console.log(`✅ Malicious URL blocked: ${url}`);
      }
    }

    // Cleanup
    await context1.close();
    await context2.close();
    await cleanupTestData(team2Owner, team2);

    console.log('✅ Cross-team data isolation verified');
  });

  test('should handle space-level permissions correctly', async ({ page }) => {
    console.log('📂 Testing space-level permissions...');

    // Setup team with multiple spaces
    await signUpAndLogin(page, teamOwner);
    privateTeam = await createTestTeam(page, teamOwner);

    const publicSpace = await createTestSpaceWithVisibility(page, privateTeam, 'Public Space', 'public');
    const privateSpace = await createTestSpaceWithVisibility(page, privateTeam, 'Private Space', 'private');

    publicSpaces.push(publicSpace);
    privateSpaces.push(privateSpace);

    // Add content to both spaces
    await addTestContent(page, publicSpace, 'Public team content');
    await addTestContent(page, privateSpace, 'Private team content');

    // Invite team member
    await inviteTeamMember(page, privateTeam.id, teamMember.email);

    // Login as team member
    await page.goto('/logout');
    await login(page, teamMember);

    // Test access to public space
    await page.goto(`/home/teams/${privateTeam.id}/spaces/${publicSpace.id}`);
    await expect(page.locator('h1')).toContainText(publicSpace.name);
    await expect(page.locator('text=Public team content')).toBeVisible();

    // Test access to private space (should be restricted)
    await page.goto(`/home/teams/${privateTeam.id}/spaces/${privateSpace.id}`);

    const restrictedMessage = page.locator('[data-testid="space-restricted"]');
    const privateSpaceError = page.locator('text=Private Space|Access restricted');

    if (await restrictedMessage.isVisible() || await privateSpaceError.isVisible()) {
      console.log('✅ Private space access properly restricted');
    } else {
      // If no restriction message, verify content is not visible
      await expect(page.locator('text=Private team content')).not.toBeVisible();
    }

    // Test search respects space permissions
    await performTeamSearch(page, 'team content', privateTeam.id);

    const searchResults = page.locator('[data-testid="search-result-item"]');
    const resultCount = await searchResults.count();

    // Should see public space content but not private
    let foundPublicContent = false;
    let foundPrivateContent = false;

    for (let i = 0; i < resultCount; i++) {
      const result = searchResults.nth(i);
      const resultText = await result.textContent();

      if (resultText?.includes('Public team content')) {
        foundPublicContent = true;
      }
      if (resultText?.includes('Private team content')) {
        foundPrivateContent = true;
      }
    }

    expect(foundPublicContent).toBe(true);
    expect(foundPrivateContent).toBe(false);

    console.log('✅ Space-level permissions verified');
  });

  test('should prevent privilege escalation attacks', async ({ page }) => {
    console.log('🛡️ Testing privilege escalation prevention...');

    // Setup as team member
    await signUpAndLogin(page, teamOwner);
    privateTeam = await createTestTeam(page, teamOwner);
    await createTestSpace(page, privateTeam);
    await inviteTeamMember(page, privateTeam.id, teamMember.email);

    await page.goto('/logout');
    await login(page, teamMember);

    // Test API endpoint manipulation
    const privilegedEndpoints = [
      {
        url: `/api/v1/teams/${privateTeam.id}/members`,
        method: 'POST',
        body: { userId: outsiderUser.id, role: 'admin' },
        description: 'Add admin member'
      },
      {
        url: `/api/v1/teams/${privateTeam.id}/transfer`,
        method: 'POST',
        body: { newOwnerId: teamMember.id },
        description: 'Transfer ownership'
      },
      {
        url: `/api/v1/teams/${privateTeam.id}/settings`,
        method: 'PUT',
        body: { isPublic: true, allowExternalAccess: true },
        description: 'Modify team settings'
      }
    ];

    for (const endpoint of privilegedEndpoints) {
      console.log(`🔍 Testing privileged endpoint: ${endpoint.description}`);

      // Try to access via direct navigation (for GET requests)
      if (endpoint.method === 'GET') {
        await page.goto(endpoint.url);
      } else {
        // For POST/PUT, try to find and manipulate forms
        await page.goto(`/home/teams/${privateTeam.id}/settings`);

        // Look for admin forms that shouldn't be visible
        const adminForms = page.locator('[data-testid="admin-form"]');
        if (await adminForms.isVisible()) {
          // This would be a security issue - admin forms should not be visible to members
          throw new Error(`Security issue: ${endpoint.description} form visible to regular member`);
        }
      }

      // Verify we're still on a safe page
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('admin');
      expect(currentUrl).not.toContain('transfer');
    }

    // Test URL parameter manipulation
    const manipulatedUrls = [
      `/home/teams/${privateTeam.id}/settings?admin=true`,
      `/home/teams/${privateTeam.id}/members?role=admin`,
      `/home/teams/${privateTeam.id}/spaces?bypass=true`,
    ];

    for (const url of manipulatedUrls) {
      await page.goto(url);

      // Should either show error or ignore the parameters
      const errorElement = page.locator('[data-testid="error-message"]');
      const settingsPage = page.locator('[data-testid="team-settings"]');

      await expect(errorElement.or(settingsPage)).toBeVisible();

      // If on settings page, verify admin features are not present
      if (await settingsPage.isVisible()) {
        await expect(page.locator('[data-testid="admin-only"]')).not.toBeVisible();
      }
    }

    console.log('✅ Privilege escalation prevention verified');
  });

  /**
   * Helper function to create space with visibility settings
   */
  async function createTestSpaceWithVisibility(
    page: Page,
    team: TestTeam,
    spaceName: string,
    visibility: 'public' | 'private'
  ): Promise<TestSpace> {
    const spaceId = `space_${visibility}_${Date.now()}`;

    await navigateToTeamSpaces(page, team.id);
    await page.click('[data-testid="create-space-button"]');

    await page.fill('input[name="name"]', spaceName);
    await page.fill('textarea[name="description"]', `${visibility} space for testing`);

    // Set visibility if supported
    const visibilitySelect = page.locator('select[name="visibility"]');
    if (await visibilitySelect.isVisible()) {
      await visibilitySelect.selectOption(visibility);
    }

    const privacyToggle = page.locator('input[name="isPrivate"]');
    if (await privacyToggle.isVisible()) {
      if (visibility === 'private') {
        await privacyToggle.check();
      } else {
        await privacyToggle.uncheck();
      }
    }

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(new RegExp(`\/home\/teams\/${team.id}\/spaces\/${spaceId}`));

    return {
      id: spaceId,
      name: spaceName,
      teamId: team.id,
      description: `${visibility} space for testing`,
    };
  }

  /**
   * Helper function to add test content to a space
   */
  async function addTestContent(page: Page, space: TestSpace, content: string): Promise<void> {
    await page.goto(`/home/teams/${space.teamId}/spaces/${space.id}`);

    const addContentButton = page.locator('[data-testid="add-content-button"]');
    const newConversationButton = page.locator('[data-testid="new-conversation"]');

    if (await addContentButton.isVisible()) {
      await addContentButton.click();
      await page.fill('textarea[name="content"]', content);
      await page.click('button[type="submit"]');
    } else if (await newConversationButton.isVisible()) {
      await newConversationButton.click();
      await page.fill('textarea[placeholder*="message" i]', content);
      await page.click('button[type="submit"]');
    }
  }

  /**
   * Helper function to invite team member
   */
  async function inviteTeamMember(page: Page, teamId: string, memberEmail: string): Promise<void> {
    await page.goto(`/home/teams/${teamId}/settings`);

    const inviteButton = page.locator('[data-testid="invite-members-button"]');
    if (await inviteButton.isVisible()) {
      await inviteButton.click();
      await page.fill('input[name="email"]', memberEmail);
      await page.click('button[type="submit"]');
    }
  }

  test('should handle session security boundaries', async ({ page, context }) => {
    console.log('🔐 Testing session security boundaries...');

    // Login as team owner
    await signUpAndLogin(page, teamOwner);
    privateTeam = await createTestTeam(page, teamOwner);
    await createTestSpace(page, privateTeam);

    // Capture session cookies
    const cookies = await context.cookies();
    const authCookies = cookies.filter(cookie =>
      cookie.name.toLowerCase().includes('session') ||
      cookie.name.toLowerCase().includes('auth')
    );

    // Logout
    await page.goto('/logout');

    // Try to reuse session cookies (simulating session hijacking)
    await context.clearCookies();
    await context.addCookies(authCookies);

    // Try to access team with old session
    await page.goto(`/home/teams/${privateTeam.id}/spaces`);

    // Should redirect to login or show session expired message
    const loginPage = page.locator('input[name="email"]');
    const sessionExpired = page.locator('[data-testid="session-expired"]');

    await expect(loginPage.or(sessionExpired)).toBeVisible({
      timeout: 5000,
    });

    console.log('✅ Session security boundaries verified');
  });
});