/*
 * Database Mock Configuration for Jest Tests
 *
 * Provides realistic Prisma mocking for CORE's multi-database setup
 */

// Mock Prisma client
export const mockPrisma = {
  // Generic mock for all models
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),

  // Team-related models
  team: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },

  teamMember: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },

  // Space-related models
  space: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },

  // Workspace models
  workspace: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },

  // User models
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },

  // Other commonly used models
  conversation: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// Mock for @core/database package
jest.mock('@core/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  Prisma: {
    sql: jest.fn((template, ...values) => ({
      template,
      values,
      toString: () => template.join('?'),
    })),
  },
}));

// Mock for trigger utils prisma
jest.mock('../app/trigger/utils/prisma', () => ({
  prisma: mockPrisma,
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset all mock return values
  Object.keys(mockPrisma).forEach(key => {
    if (typeof mockPrisma[key as keyof typeof mockPrisma] === 'object' && mockPrisma[key as keyof typeof mockPrisma] !== null) {
      const model = mockPrisma[key as keyof typeof mockPrisma] as any;
      Object.keys(model).forEach(method => {
        if (typeof model[method] === 'function') {
          model[method].mockReset();
        }
      });
    }
  });
});