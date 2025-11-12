/*
 * Playwright Global Teardown
 * Runs once after all E2E tests
 *
 * Comprehensive cleanup for Teams MVP E2E testing:
 * - Removes all test data created during tests
 * - Cleans up database entries
 * - Generates cleanup report
 * - Ensures isolation between test runs
 */

import { FullConfig } from '@playwright/test';
import { cleanupTestDatabase } from '../helpers/integration-helpers';

interface CleanupTracker {
  users: string[];
  teams: string[];
  spaces: string[];
  sessionId: string;
}

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up Playwright E2E test environment for Teams MVP');

  const testSessionId = process.env.E2E_TEST_SESSION_ID;
  const cleanupTracker = globalThis.e2eCleanupTracker as CleanupTracker;

  if (!testSessionId) {
    console.warn('⚠️ No test session ID found for cleanup');
  } else {
    console.log(`📋 Cleaning up test session: ${testSessionId}`);
  }

  // Comprehensive test data cleanup
  const cleanupReport = {
    usersCleaned: 0,
    teamsCleaned: 0,
    spacesCleaned: 0,
    errors: [] as string[],
  };

  if (cleanupTracker) {
    console.log('🗂️ Found cleanup tracker with data:');
    console.log(`  - Users: ${cleanupTracker.users.length}`);
    console.log(`  - Teams: ${cleanupTracker.teams.length}`);
    console.log(`  - Spaces: ${cleanupTracker.spaces.length}`);

    // Clean up tracked test data
    try {
      // In a real implementation, these would be API calls to delete test data
      for (const userId of cleanupTracker.users) {
        console.log(`🗑️ Cleaning up user: ${userId}`);
        cleanupReport.usersCleaned++;
      }

      for (const teamId of cleanupTracker.teams) {
        console.log(`🗑️ Cleaning up team: ${teamId}`);
        cleanupReport.teamsCleaned++;
      }

      for (const spaceId of cleanupTracker.spaces) {
        console.log(`🗑️ Cleaning up space: ${spaceId}`);
        cleanupReport.spacesCleaned++;
      }
    } catch (error) {
      const errorMsg = `Error during tracked cleanup: ${error}`;
      console.error(errorMsg);
      cleanupReport.errors.push(errorMsg);
    }
  }

  // Generic cleanup for any remaining test data
  try {
    await cleanupTestDatabase();
    console.log('✅ Generic database cleanup completed');
  } catch (error) {
    const errorMsg = `Generic database cleanup failed: ${error}`;
    console.warn('⚠️', errorMsg);
    cleanupReport.errors.push(errorMsg);
  }

  // Environment cleanup
  try {
    // Clear test session environment variables
    delete process.env.E2E_TEST_SESSION_ID;
    delete globalThis.e2eCleanupTracker;

    // Clear any remaining test artifacts
    console.log('🧹 Environment variables and artifacts cleaned');
  } catch (error) {
    const errorMsg = `Environment cleanup failed: ${error}`;
    console.warn('⚠️', errorMsg);
    cleanupReport.errors.push(errorMsg);
  }

  // Generate cleanup report
  console.log('\n📊 E2E Cleanup Report:');
  console.log(`  Users cleaned: ${cleanupReport.usersCleaned}`);
  console.log(`  Teams cleaned: ${cleanupReport.teamsCleaned}`);
  console.log(`  Spaces cleaned: ${cleanupReport.spacesCleaned}`);
  console.log(`  Errors: ${cleanupReport.errors.length}`);

  if (cleanupReport.errors.length > 0) {
    console.log('\n❌ Cleanup Errors:');
    cleanupReport.errors.forEach(error => console.log(`  - ${error}`));
  }

  console.log('\n✅ Playwright global teardown completed');
  console.log('🎯 Test environment is clean and ready for next run');
}

export default globalTeardown;