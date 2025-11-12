/*
 * Playwright Global Setup
 * Runs once before all E2E tests
 */

import { chromium, FullConfig } from '@playwright/test';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up Playwright E2E test environment');

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

  console.log('✅ Playwright global setup completed');
}

export default globalSetup;