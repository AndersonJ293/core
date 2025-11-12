/*
 * Playwright Configuration for CORE Webapp - E2E Test Suite
 *
 * Optimized for:
 * - Remix v2.16 + Vite development server
 * - Multi-database setup (PostgreSQL + Neo4j + Redis)
 * - Teams MVP workflow testing
 * - CI/CD pipeline integration
 */

import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig({ path: '.env' });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './__tests__/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report' }],
        ['junit', { outputFile: 'playwright-results/results.xml' }],
        ['github'], // GitHub Actions integration
      ]
    : [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
      ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /* Global timeout for each action */
    actionTimeout: 10000,

    /* Global timeout for each test */
    timeout: 60000,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Test isolation */
    isolateCodeExecutionContexts: true,

    /* Extra HTTP headers to send with each request */
    extraHTTPHeaders: {
      'x-playwright-test': 'true',
    },

    /* User agent */
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Playwright',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined // In CI, the server should already be running
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000, // 2 minutes to start
      },

  /* Global setup and teardown */
  globalSetup: './__tests__/e2e/global-setup.ts',
  globalTeardown: './__tests__/e2e/global-teardown.ts',

  /* Test expectations */
  expect: {
    /* Timeout for expect() assertions */
    timeout: 5000,

    /* Screenshot comparison threshold */
    toHaveScreenshot: {
      mode: 'soft',
      maxDiffPixels: 1000,
      threshold: 0.2,
    },

    /* Animation testing */
    toMatchSnapshot: {
      maxDiffPixels: 1000,
      threshold: 0.2,
    },
  },

  /* Output directory */
  outputDir: './test-results',

  /* Custom test ignore patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.cache/**',
    '**/coverage/**',
  ],

  /* Timeout for the entire test run */
  globalTimeout: process.env.CI ? 10 * 60 * 1000 : 30 * 60 * 1000, // 10 minutes on CI, 30 locally

  /* Dependencies */
  dependencies: {
    // Ensure Redis is running for tests
    redis: {
      command: 'redis-cli ping',
      retries: 3,
    },
    // Ensure PostgreSQL is accessible
    postgres: {
      command: 'psql "$DATABASE_URL" -c "SELECT 1;"',
      retries: 3,
    },
  },

  /* Environment-specific configurations */
  ...(process.env.PLAYWRIGHT_BROWSERS_PATH && {
    browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
  }),
});