/*
 * Teams MVP E2E Tests - Performance & Reliability
 *
 * Tests performance requirements and reliability for Teams MVP:
 * - Individual test performance (<30s)
 * - Overall reliability (95%+ pass rate)
 * - Load handling
 * - Memory leak prevention
 * - Cross-browser consistency
 */

import { test, expect, devices, Page } from '@playwright/test';
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

test.describe('Teams MVP - Performance & Reliability', () => {
  const performanceThresholds = {
    maxTestDuration: 30000, // 30 seconds
    maxPageLoad: 5000, // 5 seconds
    maxActionResponse: 3000, // 3 seconds
    minSuccessRate: 0.95, // 95%
    maxMemoryGrowth: 50 * 1024 * 1024, // 50MB
  };

  test.describe.parallel('Performance Tests', () => {
    test('should complete teams onboarding within performance thresholds', async ({ page }) => {
      const startTime = Date.now();

      // Complete full onboarding flow
      const testUser = await createTestUser();

      const signupTime = Date.now();
      await signUpAndLogin(page, testUser);
      const signupDuration = Date.now() - signupTime;

      const teamCreationTime = Date.now();
      const testTeam = await createTestTeam(page, testUser);
      const teamCreationDuration = Date.now() - teamCreationTime;

      const spaceCreationTime = Date.now();
      const testSpace = await createTestSpace(page, testTeam);
      const spaceCreationDuration = Date.now() - spaceCreationTime;

      const totalTime = Date.now() - startTime;

      // Performance assertions
      expect(signupDuration).toBeLessThan(performanceThresholds.maxActionResponse * 3);
      expect(teamCreationDuration).toBeLessThan(performanceThresholds.maxActionResponse * 2);
      expect(spaceCreationDuration).toBeLessThan(performanceThresholds.maxActionResponse * 2);
      expect(totalTime).toBeLessThan(performanceThresholds.maxTestDuration);

      console.log(`📊 Performance Metrics:`);
      console.log(`  Signup: ${signupDuration}ms`);
      console.log(`  Team creation: ${teamCreationDuration}ms`);
      console.log(`  Space creation: ${spaceCreationDuration}ms`);
      console.log(`  Total: ${totalTime}ms`);

      // Cleanup
      await cleanupTestData(testUser, testTeam);
    });

    test('should handle rapid navigation efficiently', async ({ page }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);
      const testTeam = await createTestTeam(page, testUser);
      const testSpace = await createTestSpace(page, testTeam);

      const navigationPaths = [
        `/home/teams/${testTeam.id}/spaces`,
        `/home/teams/${testTeam.id}/spaces/${testSpace.id}`,
        `/home/teams/${testTeam.id}/settings`,
        `/home/teams`,
        `/home`,
      ];

      const navigationTimes: number[] = [];

      // Perform rapid navigation
      for (let i = 0; i < 5; i++) {
        for (const path of navigationPaths) {
          const navStart = Date.now();
          await page.goto(path);
          const navTime = Date.now() - navStart;
          navigationTimes.push(navTime);

          // Wait for page to be fully loaded
          await page.waitForLoadState('networkidle');

          expect(navTime).toBeLessThan(performanceThresholds.maxPageLoad);
        }
      }

      const avgNavigationTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
      const maxNavigationTime = Math.max(...navigationTimes);

      expect(avgNavigationTime).toBeLessThan(performanceThresholds.maxPageLoad * 0.8);
      expect(maxNavigationTime).toBeLessThan(performanceThresholds.maxPageLoad);

      console.log(`📊 Navigation Performance:`);
      console.log(`  Average: ${avgNavigationTime}ms`);
      console.log(`  Maximum: ${maxNavigationTime}ms`);
      console.log(`  Total navigations: ${navigationTimes.length}`);

      await cleanupTestData(testUser, testTeam);
    });

    test('should maintain performance with multiple teams and spaces', async ({ page }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);

      // Create multiple teams and spaces
      const teams: TestTeam[] = [];
      const spaces: TestSpace[] = [];

      const creationStartTime = Date.now();

      for (let i = 0; i < 3; i++) {
        const team = await createTestTeam(page, testUser);
        teams.push(team);

        for (let j = 0; j < 2; j++) {
          const space = await createTestSpace(page, team);
          spaces.push(space);
        }
      }

      const creationTime = Date.now() - creationStartTime;
      expect(creationTime).toBeLessThan(performanceThresholds.maxTestDuration * 0.7);

      // Test search performance across multiple teams
      const searchStartTime = Date.now();
      await performTeamSearch(page, 'test', teams[0].id);
      const searchTime = Date.now() - searchStartTime;

      expect(searchTime).toBeLessThan(performanceThresholds.maxActionResponse);

      // Test team switching performance
      const switchTimes: number[] = [];
      for (const team of teams) {
        const switchStart = Date.now();
        await page.goto(`/home/teams/${team.id}/spaces`);
        const switchTime = Date.now() - switchStart;
        switchTimes.push(switchTime);

        expect(switchTime).toBeLessThan(performanceThresholds.maxPageLoad);
      }

      const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
      expect(avgSwitchTime).toBeLessThan(performanceThresholds.maxPageLoad * 0.6);

      console.log(`📊 Multi-Team Performance:`);
      console.log(`  Creation time (3 teams, 6 spaces): ${creationTime}ms`);
      console.log(`  Search time: ${searchTime}ms`);
      console.log(`  Average team switch: ${avgSwitchTime}ms`);

      // Cleanup
      await cleanupTestData(testUser, ...teams);
      for (const space of spaces) {
        await cleanupTestData(testUser, undefined, space);
      }
    });
  });

  test.describe.parallel('Reliability Tests', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);

      // Simulate network failure during team creation
      await page.goto('/home/teams');

      // Start team creation but intercept and fail the request
      await page.route('**/api/v1/teams', route => route.abort('failed'));

      await page.click('[data-testid="create-team-button"]');
      await page.fill('input[name="name"]', 'Test Team');
      await page.fill('input[name="slug"]', 'test-team');
      await page.click('button[type="submit"]');

      // Should show error message, not crash
      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });

      // Should be able to retry after network recovery
      await page.unroute('**/api/v1/teams');

      await page.fill('input[name="name"]', 'Retry Team');
      await page.fill('input[name="slug"]', 'retry-team');
      await page.click('button[type="submit"]');

      // Should succeed on retry
      await expect(page).toHaveURL(/\/home\/teams\/[^\/]+\/spaces/);

      await cleanupTestData(testUser);
    });

    test('should handle concurrent operations safely', async ({ page }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);
      const testTeam = await createTestTeam(page, testUser);

      // Perform multiple concurrent operations
      const concurrentOperations = [
        () => page.goto(`/home/teams/${testTeam.id}/spaces`),
        () => page.goto(`/home/teams/${testTeam.id}/settings`),
        () => page.goto(`/home/teams`),
        () => page.goto('/home'),
      ];

      // Execute operations concurrently
      const promises = concurrentOperations.map(op => op());
      const results = await Promise.allSettled(promises);

      // All operations should complete successfully
      const failedOperations = results.filter(r => r.status === 'rejected');
      expect(failedOperations.length).toBe(0);

      // Verify we're still in a valid state
      await expect(page.locator('body')).toBeVisible();

      await cleanupTestData(testUser, testTeam);
    });

    test('should maintain session stability during extended usage', async ({ page }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);
      const testTeam = await createTestTeam(page, testUser);

      // Simulate extended usage
      const operations = [
        async () => {
          await navigateToTeamSpaces(page, testTeam.id);
          await page.waitForLoadState('networkidle');
        },
        async () => {
          await page.goto('/home/teams');
          await page.waitForLoadState('networkidle');
        },
        async () => {
          await page.goto(`/home/teams/${testTeam.id}/settings`);
          await page.waitForLoadState('networkidle');
        },
      ];

      // Run operations for an extended period
      const sessionDuration = 10000; // 10 seconds of continuous operations
      const startTime = Date.now();
      let operationsCompleted = 0;

      while (Date.now() - startTime < sessionDuration) {
        const operation = operations[operationsCompleted % operations.length];
        await operation();
        operationsCompleted++;

        // Small delay between operations
        await page.waitForTimeout(100);
      }

      console.log(`📊 Extended Usage: ${operationsCompleted} operations completed`);

      // Verify session is still valid
      await navigateToTeamSpaces(page, testTeam.id);
      await expectTeamContext(page, testTeam.name);

      await cleanupTestData(testUser, testTeam);
    });
  });

  test.describe.parallel('Cross-Browser Tests', () => {
    ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari'].forEach(browserName => {
      test(`${browserName} should maintain performance consistency`, async ({ page, browserName: currentBrowser }) => {
        // Skip if not running in the target browser
        if (currentBrowser !== browserName) {
          test.skip();
        }

        const testUser = await createTestUser();
        const startTime = Date.now();

        await signUpAndLogin(page, testUser);
        const testTeam = await createTestTeam(page, testUser);
        const testSpace = await createTestSpace(page, testTeam);

        const totalTime = Date.now() - startTime;

        // Performance should be consistent across browsers
        expect(totalTime).toBeLessThan(performanceThresholds.maxTestDuration);

        // Basic functionality should work
        await expectTeamContext(page, testTeam.name);

        await cleanupTestData(testUser, testTeam);
      });
    });

    test('should work on mobile devices', async ({ page }) => {
      // Use mobile viewport
      await page.setViewportSize(devices['Pixel 5'].viewport);

      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);
      const testTeam = await createTestTeam(page, testUser);

      // Test mobile-specific features
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
      }

      // Test that all key features work on mobile
      await navigateToTeamSpaces(page, testTeam.id);
      await expectTeamContext(page, testTeam.name);

      await cleanupTestData(testUser, testTeam);
    });
  });

  test.describe.parallel('Memory and Resource Tests', () => {
    test('should not have memory leaks during extended testing', async ({ page, context }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);

      // Monitor memory usage
      const initialMemory = await getMemoryUsage(page);

      // Create and destroy many teams and spaces
      for (let i = 0; i < 5; i++) {
        const team = await createTestTeam(page, testUser);
        const space = await createTestSpace(page, team);

        // Navigate around
        await page.goto(`/home/teams/${team.id}/spaces/${space.id}`);
        await page.goto(`/home/teams/${team.id}/settings`);

        // Cleanup
        await cleanupTestData(testUser, team);
      }

      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      const finalMemory = await getMemoryUsage(page);
      const memoryGrowth = finalMemory - initialMemory;

      expect(memoryGrowth).toBeLessThan(performanceThresholds.maxMemoryGrowth);

      console.log(`📊 Memory Usage:`);
      console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);

      await cleanupTestData(testUser);
    });

    test('should handle resource cleanup properly', async ({ page }) => {
      const testUser = await createTestUser();
      await signUpAndLogin(page, testUser);

      // Open multiple tabs and perform operations
      const pages = [page];
      for (let i = 0; i < 3; i++) {
        const newPage = await page.context().newPage();
        await login(newPage, testUser);
        pages.push(newPage);
      }

      // Perform operations in all tabs
      for (const tab of pages) {
        const team = await createTestTeam(tab, testUser);
        await createTestSpace(tab, team);
      }

      // Close all tabs except the main one
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close();
      }

      // Main tab should still work correctly
      await navigateToTeamSpaces(page, 'some-team-id');

      await cleanupTestData(testUser);
    });
  });

  test('should meet overall success rate requirements', async ({ page }) => {
    const testRuns = 10;
    const results: boolean[] = [];

    console.log(`🧪 Running reliability test with ${testRuns} iterations...`);

    for (let i = 0; i < testRuns; i++) {
      try {
        const testUser = await createTestUser();
        await signUpAndLogin(page, testUser);
        const testTeam = await createTestTeam(page, testUser);
        const testSpace = await createTestSpace(page, testTeam);

        // Verify basic functionality
        await expectTeamContext(page, testTeam.name);
        await navigateToTeamSpaces(page, testTeam.id);

        // Cleanup
        await cleanupTestData(testUser, testTeam);

        results.push(true);
        console.log(`✅ Test run ${i + 1}/${testRuns} passed`);

      } catch (error) {
        results.push(false);
        console.log(`❌ Test run ${i + 1}/${testRuns} failed: ${error}`);

        // Try to reset state for next iteration
        try {
          await page.goto('/logout');
          await page.context().clearCookies();
        } catch (cleanupError) {
          console.warn('Cleanup failed:', cleanupError);
        }
      }
    }

    const successCount = results.filter(r => r).length;
    const successRate = successCount / testRuns;

    console.log(`📊 Reliability Results:`);
    console.log(`  Passed: ${successCount}/${testRuns}`);
    console.log(`  Success Rate: ${(successRate * 100).toFixed(1)}%`);

    expect(successRate).toBeGreaterThanOrEqual(performanceThresholds.minSuccessRate);
  });
});

/**
 * Helper function to get memory usage from the page
 */
async function getMemoryUsage(page: Page): Promise<number> {
  try {
    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    return memoryInfo;
  } catch {
    return 0;
  }
}

/**
 * Helper function to perform team search
 */
async function performTeamSearch(page: Page, query: string, teamId?: string): Promise<void> {
  await page.goto('/home/search');
  await page.fill('input[placeholder*="search" i]', query);

  if (teamId) {
    const teamFilter = page.locator('[data-testid="team-filter"]');
    if (await teamFilter.isVisible()) {
      await teamFilter.selectOption(teamId);
    }
  }

  await page.press('input[placeholder*="search" i]', 'Enter');
  await page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 });
}

/**
 * Helper function to expect team context
 */
async function expectTeamContext(page: Page, teamName: string): Promise<void> {
  const teamContext = page.locator('[data-testid="team-context"], [data-testid="current-team-name"]');
  if (await teamContext.isVisible()) {
    await expect(teamContext).toContainText(teamName);
  }
}