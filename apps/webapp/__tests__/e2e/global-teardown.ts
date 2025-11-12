/*
 * Playwright Global Teardown
 * Runs once after all E2E tests
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up Playwright E2E test environment');

  // Clean up test data if needed
  // await cleanupTestData();

  // Close any remaining browser instances
  // await closeAllBrowsers();

  console.log('✅ Playwright global teardown completed');
}

export default globalTeardown;