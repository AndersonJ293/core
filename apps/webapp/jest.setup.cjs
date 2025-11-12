/*
 * Simplified Jest Setup for CORE Teams MVP Testing
 */

require('@testing-library/jest-dom');

// Load test environment variables
const path = require('path');
const dotenv = require('dotenv');

// Load .env.test file
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

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

// Mock global Response object for server-side environment
global.Response = class Response {
  constructor(body, init = {}) {
    // Handle different body formats
    if (typeof body === 'object' && body !== null) {
      this._body = JSON.stringify(body);
    } else {
      this._body = body;
    }

    this.status = init?.status || 200;
    this.statusText = init?.statusText || 'OK';
    this.headers = new Map();

    if (init?.headers) {
      if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => this.headers.set(key, value));
      } else if (typeof init.headers === 'object') {
        Object.entries(init.headers).forEach(([key, value]) => this.headers.set(key, value));
      }
    }
  }

  async json() {
    if (typeof this._body === 'string') {
      try {
        return JSON.parse(this._body);
      } catch {
        return this._body;
      }
    }
    return this._body;
  }

  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }
};

// Mock Headers constructor
global.Headers = class Headers {
  constructor(init = {}) {
    this.data = new Map();

    if (Array.isArray(init)) {
      init.forEach(([key, value]) => this.data.set(key, value));
    } else if (typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => this.data.set(key, value));
    }
  }

  get(key) {
    return this.data.get(key);
  }

  set(key, value) {
    this.data.set(key, value);
  }

  has(key) {
    return this.data.has(key);
  }

  delete(key) {
    return this.data.delete(key);
  }
};

// Mock AbortController
global.AbortController = class AbortController {
  constructor() {
    this.signal = {
      aborted: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  }

  abort() {
    this.signal.aborted = true;
  }
};