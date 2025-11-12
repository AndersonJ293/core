/*
 * Neo4j Mock Configuration for Jest Tests
 *
 * Provides realistic Neo4j driver mocking for CORE's knowledge graph
 */

import { jest } from '@jest/globals';

// Mock Neo4j records
export const mockNeo4jRecord = {
  get: jest.fn(),
  keys: jest.fn(),
  values: jest.fn(),
  length: jest.fn(),
  toObject: jest.fn(),
};

// Mock Neo4j session
export const mockNeo4jSession = {
  run: jest.fn().mockResolvedValue({
    records: [mockNeo4jRecord],
    summary: {
      resultAvailableAfter: jest.fn(),
      resultConsumedAfter: jest.fn(),
      counters: {
        updates: jest.fn(),
        relationshipsCreated: jest.fn(),
        relationshipsDeleted: jest.fn(),
        nodesCreated: jest.fn(),
        nodesDeleted: jest.fn(),
        labelsAdded: jest.fn(),
        labelsRemoved: jest.fn(),
        propertiesSet: jest.fn(),
        indexesAdded: jest.fn(),
        indexesRemoved: jest.fn(),
        constraintsAdded: jest.fn(),
        constraintsRemoved: jest.fn(),
      },
      query: {
        text: jest.fn(),
        parameters: jest.fn(),
      },
      queryType: jest.fn(),
      plan: jest.fn(),
        profile: jest.fn(),
    },
  }),
  close: jest.fn().mockResolvedValue(undefined),
  readTransaction: jest.fn(),
  writeTransaction: jest.fn(),
};

// Mock Neo4j driver
export const mockNeo4jDriver = {
  verifyConnectivity: jest.fn().mockResolvedValue(undefined),
  session: jest.fn(() => mockNeo4jSession),
  close: jest.fn().mockResolvedValue(undefined),
  // For internal session management
  _sessionId: 1,
  _sessions: [],
};

// Mock neo4j package
jest.mock('neo4j-driver', () => ({
  driver: jest.fn(() => mockNeo4jDriver),
  auth: {
    basic: jest.fn((username, password) => ({ username, password })),
  },
  session: {
    READ: 'READ',
    WRITE: 'WRITE',
    DEFAULT: 'DEFAULT',
  },
  int: jest.fn((value) => ({ toNumber: () => value, toString: () => value.toString() })),
  isInt: jest.fn((value) => typeof value === 'object' && value.toNumber),
  isPoint: jest.fn(() => false),
  isDate: jest.fn(() => false),
  isTime: jest.fn(() => false),
  isLocalTime: jest.fn(() => false),
  isDateTime: jest.fn(() => false),
  isLocalDateTime: jest.fn(() => false),
  isDuration: jest.fn(() => false),
  Node: jest.fn(),
  Relationship: jest.fn(),
  Path: jest.fn(),
  PathSegment: jest.fn(),
  types: {
    Node: jest.fn(),
    Relationship: jest.fn(),
    Path: jest.fn(),
    PathSegment: jest.fn(),
    Number: {
      toNumber: jest.fn(),
      isInteger: jest.fn(),
      isInfinite: jest.fn(),
      isNaN: jest.fn(),
      parseFloat: jest.fn(),
      isSafeInteger: jest.fn(),
    },
    String: {
      trimStart: jest.fn(),
      trimEnd: jest.fn(),
    },
    Date: {
      standard: jest.fn(),
      isoWeek: jest.fn(),
      isoSeconds: jest.fn(),
    },
  },
}));

// Mock the main Neo4j server functions
jest.mock('../app/lib/neo4j.server.ts', () => ({
  driver: mockNeo4jDriver,
  verifyConnectivity: jest.fn().mockResolvedValue(true),
  runQuery: jest.fn().mockResolvedValue([mockNeo4jRecord]),
  initializeSchema: jest.fn().mockResolvedValue(true),
  closeDriver: jest.fn().mockResolvedValue(undefined),
  initNeo4jSchemaOnce: jest.fn().mockResolvedValue(undefined),
  getAllNodesForUser: jest.fn().mockResolvedValue([mockNeo4jRecord]),
  getNodeLinks: jest.fn().mockResolvedValue([]),
  getClusteredGraphData: jest.fn().mockResolvedValue([]),
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset mock Neo4j functions
  mockNeo4jDriver.session.mockReset().mockReturnValue(mockNeo4jSession);
  mockNeo4jDriver.verifyConnectivity.mockReset().mockResolvedValue(undefined);
  mockNeo4jSession.run.mockReset().mockResolvedValue({
    records: [mockNeo4jRecord],
    summary: {
      resultAvailableAfter: jest.fn(),
      resultConsumedAfter: jest.fn(),
      counters: {
        updates: jest.fn(),
        relationshipsCreated: jest.fn(),
        relationshipsDeleted: jest.fn(),
        nodesCreated: jest.fn(),
        nodesDeleted: jest.fn(),
        labelsAdded: jest.fn(),
        labelsRemoved: jest.fn(),
        propertiesSet: jest.fn(),
        indexesAdded: jest.fn(),
        indexesRemoved: jest.fn(),
        constraintsAdded: jest.fn(),
        constraintsRemoved: jest.fn(),
      },
      query: {
        text: jest.fn(),
        parameters: jest.fn(),
      },
      queryType: jest.fn(),
      plan: jest.fn(),
      profile: jest.fn(),
    },
  });
  mockNeo4jSession.close.mockReset().mockResolvedValue(undefined);
});