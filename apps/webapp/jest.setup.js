/*
 * Jest Global Setup Configuration
 *
 * Configures testing environment for CORE Teams MVP testing
 * This file runs before every test suite
 */

require('@testing-library/jest-dom');

// Import mocks (this configures all the mocks)
require('./__mocks__/database');
require('./__mocks__/neo4j');
require('./__mocks__/redis');
require('./__mocks__/env');

// Custom matchers for Teams MVP testing
expect.extend({
  // Custom matcher to check if a user has team permissions
  toHaveTeamPermission(received, expectedRole) {
    const role = typeof received === 'string' ? received : received?.role;
    const pass = role === expectedRole;

    return {
      message: () =>
        pass
          ? `expected team role not to be ${expectedRole}`
          : `expected team role to be ${expectedRole}, but got ${role}`,
      pass,
    };
  },

  // Custom matcher to check if space access is granted
  toHaveSpaceAccess(received, expectedAction = 'read') {
    const hasAccess = typeof received === 'boolean' ? received : received?.allowed;
    const pass = hasAccess === true;

    return {
      message: () =>
        pass
          ? `expected space access to be denied for ${expectedAction}`
          : `expected space access to be granted for ${expectedAction}`,
      pass,
    };
  },

  // Custom matcher to check Prisma-like objects
  toBeValidTeam(received) {
    const isValid = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      received.workspaceId;

    return {
      message: () =>
        isValid
          ? `expected team not to be valid`
          : `expected team to have id, name, and workspaceId`,
      pass: isValid,
    };
  },

  // Custom matcher to check permission service responses
  toHavePermissionResult(received, expectedValue) {
    const actualValue = typeof received === 'boolean' ? received : received?.allowed;
    const pass = actualValue === expectedValue;

    return {
      message: () =>
        pass
          ? `expected permission check to be ${!expectedValue}`
          : `expected permission check to be ${expectedValue}, but got ${actualValue}`,
      pass,
    };
  },
});

// Global test utilities
global.testUtils = {
  // Helper to create test team data
  createTestTeam: (overrides = {}) => ({
    id: 'team_test_123',
    name: 'Test Team',
    description: 'A test team for unit testing',
    workspaceId: 'workspace_test_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: null,
    ...overrides,
  }),

  // Helper to create test user data
  createTestUser: (overrides = {}) => ({
    id: 'user_test_123',
    name: 'Test User',
    email: 'test@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  // Helper to create test space data
  createTestSpace: (overrides = {}) => ({
    id: 'space_test_123',
    name: 'Test Space',
    description: 'A test space',
    visibility: 'TEAM',
    workspaceId: 'workspace_test_123',
    teamId: 'team_test_123',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: null,
    ...overrides,
  }),

  // Helper to create test team member data
  createTestTeamMember: (overrides = {}) => ({
    id: 'member_test_123',
    userId: 'user_test_123',
    teamId: 'team_test_123',
    role: 'MEMBER',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: null,
    ...overrides,
  }),
};

// Global performance monitoring
global.testPerformance = {
  // Track slow tests
  slowTestThreshold: 1000, // 1 second
  slowTests: [],

  markSlowTest: (testName, duration) => {
    if (duration > global.testPerformance.slowTestThreshold) {
      global.testPerformance.slowTests.push({ testName, duration });
      console.warn(`⚠️  Slow test detected: ${testName} (${duration}ms)`);
    }
  },

  // Report slow tests at the end
  reportSlowTests: () => {
    if (global.testPerformance.slowTests.length > 0) {
      console.log('\n🐌 Slow Tests Summary:');
      global.testPerformance.slowTests.forEach(({ testName, duration }) => {
        console.log(`  - ${testName}: ${duration}ms`);
      });
    }
  },
};

// Console filtering for cleaner test output
const originalConsole = global.console;
const originalLog = originalConsole.log;

// Filter out known noise
const filteredLogPatterns = [
  /🔌 setting up prisma client/,
  /prisma client connected/,
  /Connected to Neo4j database/,
  /🔌 read replica/,
];

global.console = {
  ...originalConsole,
  log: (...args) => {
    const message = args.join(' ');
    const shouldFilter = filteredLogPatterns.some(pattern => pattern.test(message));

    if (!shouldFilter) {
      originalLog.apply(originalConsole, args);
    }
  },
};

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Setup cleanup after all tests
afterAll(() => {
  // Restore original console
  global.console = originalConsole;

  // Report slow tests
  global.testPerformance.reportSlowTests();
});

// Mock window.matchMedia for components that use it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver for components that need it
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver for scroll-based components
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Set timezone for consistent date testing
process.env.TZ = 'UTC';

// Mock crypto.randomUUID for consistent test IDs
Object.defineProperty(global, 'crypto', {
  value: {
    ...global.crypto,
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  },
});

console.log('✅ Jest setup completed for CORE Teams MVP testing');