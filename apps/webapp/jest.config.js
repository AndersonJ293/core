/*
 * Jest Configuration for CORE Webapp - Enterprise Test Suite
 *
 * Optimized for:
 * - Remix v2.16 + TypeScript
 * - Multi-database (PostgreSQL + Neo4j + Redis)
 * - Prisma ORM with @core/database workspace package
 * - Teams MVP features (PermissionService, Spaces, Teams)
 */

/** @type {import('jest').Config} */
const config = {
  // Test environment
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // TypeScript and path mapping
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Handle path aliases from tsconfig
    ...pathsToModuleNameMapper(
      // @ts-expect-error - ts-jest mapper expects Record<string, string[]>
      tsconfig.compilerOptions?.paths || {},
      { prefix: '<rootDir>/' }
    ),
    // Mock asset files
    '\\.(css|less|scss|sass|sss|styl)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
  },

  // Module transformation
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: false,
      isolatedModules: true
    }],
  },

  // Test patterns and coverage
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '<rootDir>/app/**/__tests__/**/*.(test|spec).(ts|tsx|js|jsx)',
    '<rootDir>/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/*.stories.{ts,tsx}',
    '!app/**/index.ts',
    '!app/routes/**/*.tsx', // Skip Remix routes for now (complex Remix-specific patterns)
    '!app/entry.client.tsx',
    '!app/entry.server.tsx',
    '!app/root.tsx',
    '!app/db.server.ts', // Database connections are complex to unit test
    '!app/trigger/**/*', // Skip Trigger.dev background jobs
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },

  // Database and service mocking
  setupFiles: ['<rootDir>/__mocks__/database.ts', '<rootDir>/__mocks__/neo4j.ts'],

  // Global test configuration
  globalSetup: '<rootDir>/__tests__/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/global-teardown.ts',

  // Performance and caching
  maxWorkers: '50%', // Use half of available CPUs to avoid memory issues
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  transformIgnorePatterns: [
    'node_modules/(?!(@remix-run|@remix-run/*|@radix-ui|@core|remix-auth|remix-themes)/)'
  ],

  // Test timeout and retries
  testTimeout: 10000, // 10 seconds per test
  maxConcurrency: 5, // Limit concurrent tests for database-heavy operations

  // Verbose output for debugging
  verbose: false,
  errorOnDeprecated: true,

  // Mock system modules
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/build/'],

  // Environment variables
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },

  // Custom matchers and assertions
  snapshotSerializers: [],

  // Add custom matchers for teams/permissions testing
  extraGlobals: ['crypto'],
};

module.exports = config;