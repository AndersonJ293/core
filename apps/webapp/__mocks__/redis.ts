/*
 * Redis Mock Configuration for Jest Tests
 *
 * Provides realistic Redis client mocking for CORE's caching needs
 */

import { jest } from '@jest/globals';

// Mock Redis client
export const mockRedisClient = {
  // Basic commands
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),

  // Hash commands
  hget: jest.fn(),
  hset: jest.fn(),
  hgetall: jest.fn(),
  hdel: jest.fn(),
  hexists: jest.fn(),

  // List commands
  lpush: jest.fn(),
  rpush: jest.fn(),
  lrange: jest.fn(),
  lpop: jest.fn(),
  rpop: jest.fn(),

  // Set commands
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  sismember: jest.fn(),

  // Transaction
  multi: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),

  // Pub/Sub
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),

  // Connection
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  isOpen: false,
};

// Mock ioredis package
jest.mock('ioredis', () => ({
  default: jest.fn(() => mockRedisClient),
  Redis: jest.fn(() => mockRedisClient),
}));

// Mock singleton pattern
jest.mock('../app/lib/redis.server.ts', () => ({
  redis: mockRedisClient,
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset default behaviors
  mockRedisClient.get.mockReset();
  mockRedisClient.set.mockResolvedValue('OK');
  mockRedisClient.setex.mockResolvedValue('OK');
  mockRedisClient.del.mockResolvedValue(1);
  mockRedisClient.exists.mockResolvedValue(0);
  mockRedisClient.expire.mockResolvedValue(1);
  mockRedisClient.ttl.mockResolvedValue(-1);
  mockRedisClient.hget.mockReset();
  mockRedisClient.hset.mockResolvedValue(1);
  mockRedisClient.hgetall.mockResolvedValue({});
  mockRedisClient.hdel.mockResolvedValue(1);
  mockRedisClient.hexists.mockResolvedValue(0);
  mockRedisClient.lpush.mockResolvedValue(1);
  mockRedisClient.rpush.mockResolvedValue(1);
  mockRedisClient.lrange.mockResolvedValue([]);
  mockRedisClient.lpop.mockResolvedValue(null);
  mockRedisClient.rpop.mockResolvedValue(null);
  mockRedisClient.sadd.mockResolvedValue(1);
  mockRedisClient.srem.mockResolvedValue(1);
  mockRedisClient.smembers.mockResolvedValue([]);
  mockRedisClient.sismember.mockResolvedValue(0);
  mockRedisClient.publish.mockResolvedValue(1);
  mockRedisClient.connect.mockResolvedValue(undefined);
  mockRedisClient.disconnect.mockResolvedValue(undefined);
  mockRedisClient.isOpen = true;
});