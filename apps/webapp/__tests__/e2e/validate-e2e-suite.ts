#!/usr/bin/env tsx

/*
 * E2E Test Suite Validation Script
 *
 * Validates the complete Teams MVP E2E test suite:
 * - Checks test file structure
 * - Validates helper functions
 * - Ensures proper imports and dependencies
 * - Generates validation report
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidationReport {
  totalFiles: number;
  validFiles: number;
  issues: Array<{
    file: string;
    type: 'error' | 'warning';
    message: string;
  }>;
  helpers: {
    found: string[];
    missing: string[];
  };
  performance: {
    maxTestDuration: number;
    testsWithTimeouts: number;
  };
}

const REQUIRED_HELPERS = [
  'createTestUser',
  'signUpAndLogin',
  'createTestTeam',
  'createTestSpace',
  'navigateToTeamSpaces',
  'cleanupTestData',
  'expectTeamContext',
];

const PERFORMANCE_THRESHOLD = 30000; // 30 seconds

async function validateE2ESuite(): Promise<ValidationReport> {
  console.log('🔍 Validating Teams MVP E2E Test Suite...\n');

  const e2eDir = resolve(__dirname);
  const report: ValidationReport = {
    totalFiles: 0,
    validFiles: 0,
    issues: [],
    helpers: {
      found: [],
      missing: [],
    },
    performance: {
      maxTestDuration: 0,
      testsWithTimeouts: 0,
    },
  };

  // Find all test files
  const allFiles = readdirSync(e2eDir);
  const testFiles = allFiles.filter(file => file.endsWith('.spec.ts'));
  report.totalFiles = testFiles.length;

  console.log(`📁 Found ${testFiles.length} test files:`);
  testFiles.forEach(file => console.log(`   - ${file}`));

  // Validate each test file
  for (const testFile of testFiles) {
    console.log(`\n🔍 Validating ${testFile}...`);
    await validateTestFile(join(e2eDir, testFile), report);
  }

  // Check helpers
  console.log('\n🔧 Checking helper functions...');
  await validateHelpers(report);

  // Check cleanup system
  console.log('\n🧹 Checking cleanup system...');
  await validateCleanupSystem(report);

  // Check global setup/teardown
  console.log('\n⚙️ Checking global setup/teardown...');
  await validateGlobalSetup(report);

  // Generate summary
  console.log('\n📊 Validation Summary:');
  console.log(`   Total files: ${report.totalFiles}`);
  console.log(`   Valid files: ${report.validFiles}`);
  console.log(`   Issues: ${report.issues.length}`);

  if (report.issues.length > 0) {
    console.log('\n❌ Issues found:');
    report.issues.forEach(issue => {
      const icon = issue.type === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} ${issue.file}: ${issue.message}`);
    });
  } else {
    console.log('\n✅ All validations passed!');
  }

  return report;
}

async function validateTestFile(filePath: string, report: ValidationReport): Promise<void> {
  try {
    const content = readFileSync(filePath, 'utf8');
    const fileName = filePath.split('/').pop()!;

    // Check for basic test structure
    if (!content.includes("test.describe(")) {
      report.issues.push({
        file: fileName,
        type: 'error',
        message: 'Missing test.describe() block',
      });
      return;
    }

    if (!content.includes("test('")) {
      report.issues.push({
        file: fileName,
        type: 'error',
        message: 'No test cases found',
      });
      return;
    }

    // Check imports
    if (!content.includes("import { test, expect") || !content.includes("from '@playwright/test'")) {
      report.issues.push({
        file: fileName,
        type: 'error',
        message: 'Missing Playwright imports',
      });
    }

    // Check for helper imports
    const helperImports = [
      'createTestUser',
      'signUpAndLogin',
      'createTestTeam',
      'cleanupTestData',
    ];

    for (const helper of helperImports) {
      if (content.includes(helper) && !content.includes("../helpers/e2e-helpers")) {
        report.issues.push({
          file: fileName,
          type: 'warning',
          message: `Using ${helper} but not importing from e2e-helpers`,
        });
      }
    }

    // Check for async/await usage
    if (content.includes('test(') && !content.includes('async')) {
      report.issues.push({
        file: fileName,
        type: 'warning',
        message: 'Test cases should use async/await',
      });
    }

    // Check for proper error handling
    if (content.includes('page.goto(') && !content.includes('try') && !content.includes('expect')) {
      report.issues.push({
        file: fileName,
        type: 'warning',
        message: 'Missing error handling for navigation',
      });
    }

    // Check performance thresholds
    const timeoutMatches = content.match(/test\.setTimeout\((\d+)\)/g);
    if (timeoutMatches) {
      for (const match of timeoutMatches) {
        const timeout = parseInt(match.match(/\((\d+)\)/)![1]);
        report.performance.maxTestDuration = Math.max(report.performance.maxTestDuration, timeout);
        report.performance.testsWithTimeouts++;

        if (timeout > PERFORMANCE_THRESHOLD * 2) {
          report.issues.push({
            file: fileName,
            type: 'warning',
            message: `Very long timeout: ${timeout}ms`,
          });
        }
      }
    }

    // Check for proper cleanup
    if (content.includes('createTestUser(') && !content.includes('cleanupTestData(')) {
      report.issues.push({
        file: fileName,
        type: 'error',
        message: 'Creating test data but not cleaning up',
      });
    }

    // Check for test data isolation
    if (content.includes('Date.now()') || content.includes('randomUUID()')) {
      // Good - using random data for isolation
    } else if (content.includes('const testUser = {') && !content.includes('Date.now()')) {
      report.issues.push({
        file: fileName,
        type: 'warning',
        message: 'Test data might not be isolated between runs',
      });
    }

    report.validFiles++;
    console.log(`   ✅ ${fileName} - Valid`);

  } catch (error) {
    report.issues.push({
      file: filePath.split('/').pop()!,
      type: 'error',
      message: `Failed to read file: ${error}`,
    });
    console.log(`   ❌ ${filePath.split('/').pop()} - Error reading file`);
  }
}

async function validateHelpers(report: ValidationReport): Promise<void> {
  const helpersPath = join(__dirname, '../helpers/e2e-helpers.ts');

  if (!existsSync(helpersPath)) {
    report.issues.push({
      file: 'e2e-helpers.ts',
      type: 'error',
      message: 'Helper file not found',
    });
    return;
  }

  try {
    const helperContent = readFileSync(helpersPath, 'utf8');

    for (const helper of REQUIRED_HELPERS) {
      if (helperContent.includes(`export async function ${helper}`) ||
          helperContent.includes(`export function ${helper}`)) {
        report.helpers.found.push(helper);
      } else {
        report.helpers.missing.push(helper);
        report.issues.push({
          file: 'e2e-helpers.ts',
          type: 'error',
          message: `Missing helper function: ${helper}`,
        });
      }
    }

    console.log(`   ✅ Found ${report.helpers.found.length} helpers`);
    if (report.helpers.missing.length > 0) {
      console.log(`   ❌ Missing ${report.helpers.missing.length} helpers`);
    }

  } catch (error) {
    report.issues.push({
      file: 'e2e-helpers.ts',
      type: 'error',
      message: `Failed to read helpers: ${error}`,
    });
  }
}

async function validateCleanupSystem(report: ValidationReport): Promise<void> {
  const cleanupPath = join(__dirname, '../helpers/e2e-cleanup.ts');
  const globalSetupPath = join(__dirname, 'global-setup.ts');
  const globalTeardownPath = join(__dirname, 'global-teardown.ts');

  // Check cleanup helper
  if (!existsSync(cleanupPath)) {
    report.issues.push({
      file: 'e2e-cleanup.ts',
      type: 'error',
      message: 'Cleanup helper not found',
    });
  } else {
    try {
      const cleanupContent = readFileSync(cleanupPath, 'utf8');
      const requiredCleanupFunctions = [
        'initializeCleanupTracker',
        'trackTestData',
        'cleanupAllTrackedData',
        'cleanupBrowserSession',
      ];

      for (const func of requiredCleanupFunctions) {
        if (!cleanupContent.includes(`export`)) {
          report.issues.push({
            file: 'e2e-cleanup.ts',
            type: 'error',
            message: `Missing cleanup function: ${func}`,
          });
        }
      }

      console.log('   ✅ Cleanup system found');
    } catch (error) {
      report.issues.push({
        file: 'e2e-cleanup.ts',
        type: 'error',
        message: `Failed to read cleanup helper: ${error}`,
      });
    }
  }

  // Check global setup
  if (!existsSync(globalSetupPath)) {
    report.issues.push({
      file: 'global-setup.ts',
      type: 'error',
      message: 'Global setup not found',
    });
  } else {
    console.log('   ✅ Global setup found');
  }

  // Check global teardown
  if (!existsSync(globalTeardownPath)) {
    report.issues.push({
      file: 'global-teardown.ts',
      type: 'error',
      message: 'Global teardown not found',
    });
  } else {
    console.log('   ✅ Global teardown found');
  }
}

async function validateGlobalSetup(report: ValidationReport): Promise<void> {
  const playwrightConfigPath = join(__dirname, '../../playwright.config.ts');

  if (!existsSync(playwrightConfigPath)) {
    report.issues.push({
      file: 'playwright.config.ts',
      type: 'error',
      message: 'Playwright config not found',
    });
    return;
  }

  try {
    const configContent = readFileSync(playwrightConfigPath, 'utf8');

    // Check for E2E specific configurations
    const requiredConfigs = [
      'testDir: \'./__tests__/e2e\'',
      'globalSetup',
      'globalTeardown',
      'use: {',
      'baseURL',
    ];

    for (const config of requiredConfigs) {
      if (!configContent.includes(config)) {
        report.issues.push({
          file: 'playwright.config.ts',
          type: 'warning',
          message: `Missing configuration: ${config}`,
        });
      }
    }

    // Check for performance settings
    if (configContent.includes('timeout:')) {
      const timeoutMatch = configContent.match(/timeout:\s*(\d+)/);
      if (timeoutMatch && parseInt(timeoutMatch[1]) > PERFORMANCE_THRESHOLD * 2) {
        report.issues.push({
          file: 'playwright.config.ts',
          type: 'warning',
          message: 'Global timeout might be too long',
        });
      }
    }

    console.log('   ✅ Playwright configuration validated');

  } catch (error) {
    report.issues.push({
      file: 'playwright.config.ts',
      type: 'error',
      message: `Failed to read Playwright config: ${error}`,
    });
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateE2ESuite()
    .then((report) => {
      const hasErrors = report.issues.some(issue => issue.type === 'error');
      process.exit(hasErrors ? 1 : 0);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

export { validateE2ESuite };
export type { ValidationReport };