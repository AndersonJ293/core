/*
 * Basic Mock Setup for Jest Tests
 */

// Create mock Prisma instance
const mockPrismaInstance = {
  team: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  teamMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  space: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock @core/database package
jest.mock('@core/database', () => ({
  PrismaClient: jest.fn(() => mockPrismaInstance),
  Prisma: {
    sql: jest.fn((template, ...values) => ({
      template,
      values,
    })),
  },
}));

// Note: trigger/utils/prisma will be mocked when needed in tests

// Mock neo4j-driver
jest.mock('neo4j-driver', () => ({
  driver: jest.fn(() => ({
    verifyConnectivity: jest.fn().mockResolvedValue(true),
    session: jest.fn(() => ({
      run: jest.fn().mockResolvedValue({
        records: [],
        summary: {},
      }),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  auth: {
    basic: jest.fn(),
  },
}));

// Mock ioredis
jest.mock('ioredis', () => ({
  default: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock logger service
jest.mock('~/services/logger.service', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Export mock instance for tests
global.mockPrisma = mockPrismaInstance;