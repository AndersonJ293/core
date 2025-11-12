/*
 * Simplified Jest Setup for CORE Teams MVP Testing
 */

require('@testing-library/jest-dom');

// Import database mocks
const { mockPrisma } = require('./__mocks__/database');

// Make mockPrisma globally available
global.mockPrisma = mockPrisma;

// Basic global utilities
global.testUtils = {
  createTestTeam: (overrides = {}) => ({
    id: 'team_test_123',
    name: 'Test Team',
    workspaceId: 'workspace_test_123',
    ...overrides,
  }),
  createTestUser: (overrides = {}) => ({
    id: 'user_test_123',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  }),
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    ...global.crypto,
    randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
  },
});