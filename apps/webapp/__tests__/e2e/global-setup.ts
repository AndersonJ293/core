/*
 * Playwright Global Setup
 * Runs once before all E2E tests
 *
 * Setup for Teams MVP E2E testing:
 * - Validates server connectivity
 * - Prepares test database state
 * - Sets up test data isolation
 * - Configures cleanup mechanisms
 */

import { chromium, FullConfig } from '@playwright/test';
import { config } from 'dotenv';
import { setupTestDatabase } from '../helpers/integration-helpers';

// Load test environment variables
config({ path: '.env.test' });

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up Playwright E2E test environment for Teams MVP');

  const { baseURL } = config.webServer || { baseURL: 'http://localhost:3000' };

  // Validate server is running
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/health`, { timeout: 10000 });
    console.log('✅ Application server is responsive');
  } catch (error) {
    console.error('❌ Application server is not responding');
    console.error('   Make sure to run: pnpm dev');
    throw error;
  } finally {
    await browser.close();
  }

  // Setup test database and cleanup mechanisms
  try {
    await setupTestDatabase();
    console.log('✅ Test database setup completed');
  } catch (error) {
    console.warn('⚠️ Database setup warning (may be expected in mock environment):', error);
  }

  // Setup test data cleanup tracking
  const testSessionId = `e2e_${Date.now()}`;
  process.env.E2E_TEST_SESSION_ID = testSessionId;
  console.log(`📋 Test session ID: ${testSessionId}`);

  // Configure cleanup tracking
  const cleanupTracker = {
    users: [] as string[],
    teams: [] as string[],
    spaces: [] as string[],
    sessionId: testSessionId,
  };

  // Store cleanup tracker globally for tests to use
  globalThis.e2eCleanupTracker = cleanupTracker;

  console.log('✅ Playwright global setup completed');
  console.log('🧹 Test data cleanup mechanisms configured');
}

export default globalSetup;