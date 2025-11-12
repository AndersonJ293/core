/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  // TypeScript configuration
  preset: 'ts-jest',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Module transformation
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },

  // Module mocking
  moduleNameMapper: {
    '\\.(css|less|scss|sass|sss|styl)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '^@core/(.*)$': '<rootDir>/../../packages/$1/src',
    '^~/(.*)$': '<rootDir>/app/$1',
  },

  // Coverage
  collectCoverageFrom: [
    'app/services/**/*.ts',
    '!app/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],

  // Performance
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Timeout
  testTimeout: 10000,

  // Mocks
  setupFiles: ['<rootDir>/__mocks__/setup.js'],
};