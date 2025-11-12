/*
 * Environment Variables Mock for Jest Tests
 *
 * Provides consistent environment variable mocking for all tests
 */

import { jest } from '@jest/globals';

// Mock environment variables
const mockEnv = {
  NODE_ENV: 'test',
  POSTGRES_DB: 'test_core',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/core_test',
  DIRECT_URL: 'postgresql://test:test@localhost:5432/core_test',
  NEO4J_URI: 'bolt://localhost:7687',
  NEO4J_USERNAME: 'neo4j',
  NEO4J_PASSWORD: 'password',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'test-session-secret',
  ENCRYPTION_KEY: 'test-encryption-key-32-chars-minimum',
  MAGIC_LINK_SECRET: 'test-magic-link-secret-for-jests',
  APP_ORIGIN: 'http://localhost:3000',
  MODEL: 'test-model',
  OPENAI_API_KEY: 'test-openai-key',
  COHERE_API_KEY: 'test-cohere-key',
  EMBEDDING_MODEL_SIZE: '1024',
  // Additional variables that might be needed
  WEBAPP_PORT: '3000',
  RENOVATE_BOT_PASSWORD: 'test-password',
  RENOVATE_BOT_USERNAME: 'test-bot',
  RENOVATE_BOT_EMAIL: 'test-bot@example.com',
  LINEAR_CLIENT_ID: 'test-linear-client-id',
  LINEAR_CLIENT_SECRET: 'test-linear-client-secret',
  SLACK_CLIENT_ID: 'test-slack-client-id',
  SLACK_CLIENT_SECRET: 'test-slack-client-secret',
  GITHUB_CLIENT_ID: 'test-github-client-id',
  GITHUB_CLIENT_SECRET: 'test-github-client-secret',
  EMAIL_FROM: 'test@example.com',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_USER: 'test',
  SMTP_PASS: 'test',
  // Add more environment variables as needed
};

// Mock process.env
Object.assign(process.env, mockEnv);

// Mock the env.server module
jest.mock('../app/env.server.ts', () => ({
  env: {
    ...mockEnv,
    DATABASE_CONNECTION_LIMIT: 10,
    DATABASE_POOL_TIMEOUT: 30,
    DATABASE_CONNECTION_TIMEOUT: 30,
    VERBOSE_PRISMA_LOGS: '0',
  },
}));

export default mockEnv;