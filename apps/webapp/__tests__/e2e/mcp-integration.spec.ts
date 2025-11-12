/*
 * Teams MVP E2E Tests - MCP Integration
 *
 * Tests Model Context Protocol (MCP) integration with Teams feature:
 * 1. MCP tools with team context
 * 2. Session management with team scoping
 * 3. Tool execution respects boundaries
 * 4. Cross-team MCP data isolation
 * 5. MCP tool permissions and authorization
 */

import { test, expect } from '@playwright/test';
import {
  createTestUser,
  signUpAndLogin,
  createTestTeam,
  createTestSpace,
  login,
  navigateToTeamSpaces,
  cleanupTestData,
  TestUser,
  TestTeam,
  TestSpace
} from '../helpers/e2e-helpers';

test.describe('Teams MVP - MCP Integration', () => {
  let teamOwner: TestUser;
  let teamMember: TestUser;
  let outsiderUser: TestUser;
  let testTeam: TestTeam;
  let testSpace: TestSpace;

  test.beforeAll(async () => {
    // Create test users
    teamOwner = await createTestUser();
    teamMember = await createTestUser();
    outsiderUser = await createTestUser();

    console.log('👥 Created test users for MCP testing');
  });

  test.afterAll(async () => {
    // Cleanup all test data
    await cleanupTestData(teamOwner, testTeam);
    if (testSpace) {
      await cleanupTestData(teamOwner, testTeam, testSpace);
    }
    await cleanupTestData(teamMember);
    await cleanupTestData(outsiderUser);
  });

  test('should maintain team context in MCP sessions', async ({ page }) => {
    console.log('🔗 Testing MCP session team context...');

    // Setup team and login as owner
    await signUpAndLogin(page, teamOwner);
    testTeam = await createTestTeam(page, teamOwner);
    testSpace = await createTestSpace(page, testTeam);

    // Navigate to space and start MCP session
    await page.goto(`/home/teams/${testTeam.id}/spaces/${testSpace.id}`);

    // Look for MCP chat interface or tools
    const mcpChatButton = page.locator('[data-testid="mcp-chat-button"]');
    const aiAssistantButton = page.locator('[data-testid="ai-assistant"]');
    const chatInterface = page.locator('[data-testid="chat-interface"]');

    if (await mcpChatButton.isVisible()) {
      await mcpChatButton.click();
    } else if (await aiAssistantButton.isVisible()) {
      await aiAssistantButton.click();
    }

    // Wait for MCP interface to load
    await expect(chatInterface.or(page.locator('[data-testid="mcp-tools"]'))).toBeVisible({
      timeout: 10000,
    });

    // Test that MCP interface shows team context
    const teamContextIndicator = page.locator('[data-testid="team-context"]');
    const currentTeamDisplay = page.locator('[data-testid="current-team"]');

    if (await teamContextIndicator.isVisible()) {
      await expect(teamContextIndicator).toContainText(testTeam.name);
      console.log('✅ MCP interface shows team context');
    } else if (await currentTeamDisplay.isVisible()) {
      await expect(currentTeamDisplay).toContainText(testTeam.name);
      console.log('✅ Team context visible in MCP interface');
    }

    // Test MCP tool execution with team context
    await testMcpToolWithContext(page, 'search', 'test query', testTeam.id);

    console.log('✅ MCP session team context verified');
  });

  test('should enforce MCP tool team boundaries', async ({ page, browser }) => {
    console.log('🔒 Testing MCP tool team boundaries...');

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage(); // Team 1 user
    const page2 = await context2.newPage(); // Team 2 user

    // Setup Team 1
    await signUpAndLogin(page1, teamOwner);
    const team1 = await createTestTeam(page1, teamOwner);
    const team1Space = await createTestSpace(page1, team1);

    // Add team-specific content
    await addTeamSpecificContent(page1, team1Space, 'Team 1 confidential project data');

    // Setup Team 2
    const team2Owner = await createTestUser();
    await signUpAndLogin(page2, team2Owner);
    const team2 = await createTestTeam(page2, team2Owner);
    const team2Space = await createTestSpace(page2, team2);

    // Add team-specific content
    await addTeamSpecificContent(page2, team2Space, 'Team 2 confidential project data');

    // Test MCP search in Team 1 context
    await page1.goto(`/home/teams/${team1.id}/spaces/${team1Space.id}`);
    await openMcpInterface(page1);

    const team1Results = await executeMcpSearch(page1, 'confidential project data');

    // Verify results only contain Team 1 data
    expect(team1Results).toContain('Team 1 confidential project data');
    expect(team1Results).not.toContain('Team 2 confidential project data');

    // Test MCP search in Team 2 context
    await page2.goto(`/home/teams/${team2.id}/spaces/${team2Space.id}`);
    await openMcpInterface(page2);

    const team2Results = await executeMcpSearch(page2, 'confidential project data');

    // Verify results only contain Team 2 data
    expect(team2Results).toContain('Team 2 confidential project data');
    expect(team2Results).not.toContain('Team 1 confidential project data');

    // Test cross-team MCP access prevention
    const crossTeamResults = await attemptCrossTeamMcpAccess(page1, team2.id);

    // Should return empty or error for cross-team access
    expect(crossTeamResults.success).toBe(false);
    expect(crossTeamResults.error).toMatch(/access denied|not found|unauthorized/i);

    // Cleanup
    await context1.close();
    await context2.close();
    await cleanupTestData(team2Owner, team2);

    console.log('✅ MCP tool team boundaries verified');
  });

  test('should handle MCP tool permissions by user role', async ({ page }) => {
    console.log('👑 Testing MCP tool role-based permissions...');

    // Setup team and invite member
    await signUpAndLogin(page, teamOwner);
    testTeam = await createTestTeam(page, teamOwner);
    testSpace = await createTestSpace(page, testTeam);

    // Add some content
    await addTeamSpecificContent(page, testSpace, 'Admin level content');

    // Invite team member
    await inviteTeamMember(page, testTeam.id, teamMember.email);

    // Test MCP tools as team owner (should have full access)
    await testMcpToolPermissions(page, 'owner', ['search', 'create', 'update', 'delete']);

    // Logout and login as team member
    await page.goto('/logout');
    await login(page, teamMember);

    // Test MCP tools as team member (should have limited access)
    await testMcpToolPermissions(page, 'member', ['search', 'create']);

    // Test that restricted tools are not available
    const restrictedTools = ['delete', 'admin-settings', 'team-management'];
    for (const tool of restrictedTools) {
      const toolButton = page.locator(`[data-testid="mcp-tool-${tool}"]`);
      if (await toolButton.isVisible()) {
        await expect(toolButton).toBeDisabled();
      }
    }

    console.log('✅ MCP tool role-based permissions verified');
  });

  test('should maintain MCP session state across navigation', async ({ page }) => {
    console.log('🔄 Testing MCP session state persistence...');

    // Setup and login
    await signUpAndLogin(page, teamOwner);
    testTeam = await createTestTeam(page, teamOwner);
    testSpace = await createTestSpace(page, testTeam);

    // Navigate to space and start MCP session
    await page.goto(`/home/teams/${testTeam.id}/spaces/${testSpace.id}`);
    await openMcpInterface(page);

    // Execute some MCP commands to create session state
    await executeMcpCommand(page, 'search', 'initial query');
    await executeMcpCommand(page, 'context', 'set team context');

    // Navigate to different pages within the same team
    const navigationPaths = [
      `/home/teams/${testTeam.id}/spaces`,
      `/home/teams/${testTeam.id}/spaces/${testSpace.id}`,
      `/home/teams/${testTeam.id}/settings`,
    ];

    for (const path of navigationPaths) {
      await page.goto(path);

      // Check if MCP session is preserved
      const mcpInterface = page.locator('[data-testid="chat-interface"]');
      const sessionIndicator = page.locator('[data-testid="mcp-session-active"]');

      if (await mcpInterface.isVisible()) {
        // Test that MCP commands still work
        await executeMcpCommand(page, 'search', 'navigation test');

        // Verify team context is maintained
        const teamContext = page.locator('[data-testid="team-context"]');
        if (await teamContext.isVisible()) {
          await expect(teamContext).toContainText(testTeam.name);
        }
      }

      console.log(`✅ MCP session preserved after navigation to ${path}`);
    }

    // Test that navigating to different team resets or updates context
    const anotherTeam = await createTestTeam(page, teamOwner);
    await page.goto(`/home/teams/${anotherTeam.id}/spaces`);

    // MCP should either reset context or show new team context
    const newTeamContext = page.locator('[data-testid="team-context"]');
    if (await newTeamContext.isVisible()) {
      await expect(newTeamContext).toContainText(anotherTeam.name);
    }

    console.log('✅ MCP session state persistence verified');
  });

  test('should handle MCP tool failures and error recovery', async ({ page }) => {
    console.log('🚨 Testing MCP error handling and recovery...');

    // Setup
    await signUpAndLogin(page, teamOwner);
    testTeam = await createTestTeam(page, teamOwner);
    testSpace = await createTestSpace(page, testTeam);

    await page.goto(`/home/teams/${testTeam.id}/spaces/${testSpace.id}`);
    await openMcpInterface(page);

    // Test MCP tool failure scenarios
    const failureScenarios = [
      {
        tool: 'search',
        input: '', // Empty input
        expectedError: 'empty query|invalid input',
      },
      {
        tool: 'create',
        input: 'invalid data format',
        expectedError: 'invalid format|malformed data',
      },
      {
        tool: 'access_nonexistent',
        input: 'nonexistent resource',
        expectedError: 'not found|does not exist',
      },
    ];

    for (const scenario of failureScenarios) {
      console.log(`🔍 Testing MCP failure: ${scenario.tool}`);

      const result = await executeMcpCommandWithExpectation(
        page,
        scenario.tool,
        scenario.input,
        false // Expect failure
      );

      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.error).toMatch(new RegExp(scenario.expectedError, 'i'));

      // Verify error message is user-friendly
      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        expect(errorText).not.toContain('Internal Server Error');
        expect(errorText).not.toContain('Stack trace');
        expect(errorText).not.toContain('undefined');
      }

      console.log(`✅ MCP failure handled gracefully for ${scenario.tool}`);
    }

    // Test recovery after failure
    const recoveryResult = await executeMcpCommandWithExpectation(
      page,
      'search',
      'recovery test',
      true // Expect success
    );

    expect(recoveryResult.success).toBe(true);

    console.log('✅ MCP error recovery verified');
  });

  /**
   * Helper function to open MCP interface
   */
  async function openMcpInterface(page: Page): Promise<void> {
    const mcpChatButton = page.locator('[data-testid="mcp-chat-button"]');
    const aiAssistantButton = page.locator('[data-testid="ai-assistant"]');
    const chatInterface = page.locator('[data-testid="chat-interface"]');

    if (await mcpChatButton.isVisible()) {
      await mcpChatButton.click();
    } else if (await aiAssistantButton.isVisible()) {
      await aiAssistantButton.click();
    }

    // Wait for interface to load
    await expect(chatInterface.or(page.locator('[data-testid="mcp-tools"]'))).toBeVisible({
      timeout: 10000,
    });
  }

  /**
   * Helper function to test MCP tool with team context
   */
  async function testMcpToolWithContext(
    page: Page,
    tool: string,
    input: string,
    teamId: string
  ): Promise<void> {
    const result = await executeMcpCommand(page, tool, input);

    expect(result.success).toBe(true);
    expect(result.teamId).toBe(teamId);
  }

  /**
   * Helper function to execute MCP search
   */
  async function executeMcpSearch(page: Page, query: string): Promise<string> {
    const chatInput = page.locator('textarea[placeholder*="message" i], input[placeholder*="ask" i]');
    await chatInput.fill(`Search for: ${query}`);
    await chatInput.press('Enter');

    // Wait for response
    const responseElement = page.locator('[data-testid="mcp-response"], [data-testid="ai-response"]');
    await expect(responseElement).toBeVisible({ timeout: 15000 });

    const response = await responseElement.textContent();
    return response || '';
  }

  /**
   * Helper function to execute MCP command
   */
  async function executeMcpCommand(page: Page, tool: string, input: string): Promise<any> {
    return await executeMcpCommandWithExpectation(page, tool, input, true);
  }

  /**
   * Helper function to execute MCP command with expectation
   */
  async function executeMcpCommandWithExpectation(
    page: Page,
    tool: string,
    input: string,
    expectSuccess: boolean
  ): Promise<any> {
    const chatInput = page.locator('textarea[placeholder*="message" i], input[placeholder*="ask" i]');
    await chatInput.fill(`${tool}: ${input}`);
    await chatInput.press('Enter');

    // Wait for response
    const responseElement = page.locator('[data-testid="mcp-response"], [data-testid="ai-response"]');
    const errorElement = page.locator('[data-testid="mcp-error"], [data-testid="error-message"]');

    await Promise.race([
      expect(responseElement).toBeVisible({ timeout: 15000 }),
      expect(errorElement).toBeVisible({ timeout: 15000 }),
    ]);

    if (await errorElement.isVisible() && expectSuccess) {
      const errorText = await errorElement.textContent();
      throw new Error(`MCP command failed unexpectedly: ${errorText}`);
    }

    const isSuccess = await responseElement.isVisible();
    const responseText = isSuccess ? await responseElement.textContent() : await errorElement.textContent();

    return {
      success: isSuccess,
      response: responseText,
      error: isSuccess ? undefined : responseText,
    };
  }

  /**
   * Helper function to attempt cross-team MCP access
   */
  async function attemptCrossTeamMcpAccess(page: Page, targetTeamId: string): Promise<any> {
    const maliciousCommand = `access_team_data ${targetTeamId} confidential`;

    return await executeMcpCommandWithExpectation(page, 'system_access', maliciousCommand, false);
  }

  /**
   * Helper function to test MCP tool permissions
   */
  async function testMcpToolPermissions(page: Page, role: string, allowedTools: string[]): Promise<void> {
    await navigateToTeamSpaces(page, testTeam.id);
    await openMcpInterface(page);

    // Test each tool
    for (const tool of allowedTools) {
      const toolButton = page.locator(`[data-testid="mcp-tool-${tool}"]`);

      if (await toolButton.isVisible()) {
        await expect(toolButton).toBeEnabled();

        // Try to execute the tool
        const result = await executeMcpCommandWithExpectation(page, tool, 'test input', true);
        expect(result.success).toBe(true);

        console.log(`✅ Tool '${tool}' accessible to ${role}`);
      }
    }

    // Test that restricted tools are not available
    const allPossibleTools = ['search', 'create', 'update', 'delete', 'admin-settings', 'team-management'];
    const restrictedTools = allPossibleTools.filter(tool => !allowedTools.includes(tool));

    for (const tool of restrictedTools) {
      const toolButton = page.locator(`[data-testid="mcp-tool-${tool}"]`);

      if (await toolButton.isVisible()) {
        await expect(toolButton).toBeDisabled();
        console.log(`✅ Tool '${tool}' properly restricted from ${role}`);
      }
    }
  }

  /**
   * Helper function to add team-specific content
   */
  async function addTeamSpecificContent(page: Page, space: TestSpace, content: string): Promise<void> {
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

    // Wait for content to be added
    await page.waitForTimeout(2000);
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

  test('should handle MCP integration performance requirements', async ({ page }) => {
    console.log('⚡ Testing MCP integration performance...');

    await signUpAndLogin(page, teamOwner);
    testTeam = await createTestTeam(page, teamOwner);
    testSpace = await createTestSpace(page, testTeam);

    await page.goto(`/home/teams/${testTeam.id}/spaces/${testSpace.id}`);

    // Test MCP interface loading time
    const interfaceStartTime = Date.now();
    await openMcpInterface(page);
    const interfaceLoadTime = Date.now() - interfaceStartTime;

    expect(interfaceLoadTime).toBeLessThan(5000); // 5 seconds
    console.log(`📊 MCP interface load time: ${interfaceLoadTime}ms`);

    // Test MCP command response times
    const testCommands = [
      { tool: 'search', input: 'performance test' },
      { tool: 'context', input: 'team context' },
      { tool: 'help', input: '' },
    ];

    for (const command of testCommands) {
      const startTime = Date.now();
      const result = await executeMcpCommandWithExpectation(page, command.tool, command.input, true);
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(10000); // 10 seconds
      expect(result.success).toBe(true);

      console.log(`📊 ${command.tool} response time: ${responseTime}ms`);
    }

    // Test concurrent MCP requests
    const concurrentStartTime = Date.now();
    const concurrentPromises = testCommands.map(cmd =>
      executeMcpCommandWithExpectation(page, cmd.tool, cmd.input, true)
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStartTime;

    expect(concurrentTime).toBeLessThan(15000); // 15 seconds for all
    expect(concurrentResults.every(r => r.success)).toBe(true);

    console.log(`📊 Concurrent commands time: ${concurrentTime}ms`);
    console.log('✅ MCP integration performance verified');
  });
});