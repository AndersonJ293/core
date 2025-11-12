/*
 * Integration Test Helpers
 *
 * Shared utilities for integration tests requiring real database connections,
 * authentication, and API testing infrastructure.
 */

import { Request } from '@remix-run/node';
import { prisma } from '../../app/db.server';

// ============================================================================
// DATABASE SETUP AND CLEANUP
// ============================================================================

/**
 * Setup test database with migrations and test data
 * This should be called once before running integration tests
 */
export async function setupTestDatabase(): Promise<void> {
  // In a real implementation, this would:
  // 1. Ensure database is running
  // 2. Run migrations on test database
  // 3. Set up test schema if needed

  // For now, we assume the test database is already configured
  // in the test environment
  console.log('Setting up test database for integration tests');
}

/**
 * Cleanup test database after integration tests
 * This should be called once after completing integration tests
 */
export async function cleanupTestDatabase(): Promise<void> {
  // In a real implementation, this would:
  // 1. Clean up any remaining test data
  // 2. Close database connections
  // 3. Reset database state

  console.log('Cleaning up test database after integration tests');

  // Ensure all connections are properly closed
  await prisma.$disconnect();
}

/**
 * Create a clean test environment by deleting all test data
 * This should be called before each test if needed
 */
export async function createCleanTestEnvironment(): Promise<void> {
  // Delete all test data in correct order to avoid foreign key constraints
  const tables = [
    'space',
    'teamMember',
    'team',
    'workspace',
    'user',
  ];

  for (const table of tables) {
    try {
      await (prisma as any)[table].deleteMany({
        where: {
          id: {
            contains: '_test_',
          },
        },
      });
    } catch (error) {
      // Table might not exist or have different structure
      console.warn(`Failed to clean table ${table}:`, error);
    }
  }
}

// ============================================================================
// REQUEST AND AUTHENTICATION HELPERS
// ============================================================================

/**
 * Create a mock authentication object for testing
 */
export function createMockAuthentication(userId: string, additionalData: any = {}) {
  return {
    userId,
    ...additionalData,
  };
}

/**
 * Create a test request object that mimics Remix Request
 */
export function createTestRequest(
  method: string,
  url: string,
  body?: any,
  authentication?: any,
  headers: Record<string, string> = {}
): Request {
  const requestHeaders = new Headers({
    'content-type': 'application/json',
    ...headers,
  });

  // Add authentication headers if provided
  if (authentication) {
    requestHeaders.set('authorization', `Bearer test-token-${authentication.userId}`);
  }

  const requestData = {
    method,
    headers: requestHeaders,
    url: `http://localhost:3000${url}`,
    signal: new AbortController().signal,
  } as RequestInit;

  if (body && method !== 'GET') {
    requestData.body = JSON.stringify(body);
  }

  return new Request(`http://localhost:3000${url}`, requestData);
}

/**
 * Create a test user with specified properties
 */
export async function createTestUser(properties: Partial<any> = {}): Promise<any> {
  const userId = properties.id || `user_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await prisma.user.create({
    data: {
      id: userId,
      email: properties.email || `test-${userId}@example.com`,
      name: properties.name || 'Test User',
      ...properties,
    },
  });
}

/**
 * Create a test workspace with specified properties
 */
export async function createTestWorkspace(userId: string, properties: Partial<any> = {}): Promise<any> {
  const workspaceId = properties.id || `workspace_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: properties.name || 'Test Workspace',
      slug: properties.slug || `test-workspace-${Date.now()}`,
      userId,
      ...properties,
    },
  });
}

/**
 * Create a test team with specified properties
 */
export async function createTestTeam(workspaceId: string, properties: Partial<any> = {}): Promise<any> {
  const teamId = properties.id || `team_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await prisma.team.create({
    data: {
      id: teamId,
      name: properties.name || 'Test Team',
      slug: properties.slug || `test-team-${Date.now()}`,
      workspaceId,
      ...properties,
    },
  });
}

/**
 * Create a test team member with specified properties
 */
export async function createTestTeamMember(
  userId: string,
  teamId: string,
  role: string = 'MEMBER',
  properties: Partial<any> = {}
): Promise<any> {
  const memberId = properties.id || `member_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await prisma.teamMember.create({
    data: {
      id: memberId,
      userId,
      teamId,
      role,
      ...properties,
    },
  });
}

/**
 * Create a test space with specified properties
 */
export async function createTestSpace(
  teamId: string,
  workspaceId: string,
  properties: Partial<any> = {}
): Promise<any> {
  const spaceId = properties.id || `space_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return await prisma.space.create({
    data: {
      id: spaceId,
      name: properties.name || 'Test Space',
      slug: properties.slug || `test-space-${Date.now()}`,
      teamId,
      workspaceId,
      visibility: properties.visibility || 'TEAM',
      ...properties,
    },
  });
}

// ============================================================================
// INTEGRATION TEST SCENARIOS BUILDERS
// ============================================================================

/**
 * Create a complete test scenario with user, workspace, team, and permissions
 */
export async function createTestTeamScenario(
  userRole: string = 'OWNER',
  additionalData: Partial<any> = {}
): Promise<{
  user: any;
  workspace: any;
  team: any;
  teamMember: any;
}> {
  // Create user
  const user = await createTestUser(additionalData.user);

  // Create workspace
  const workspace = await createTestWorkspace(user.id, additionalData.workspace);

  // Create team
  const team = await createTestTeam(workspace.id, additionalData.team);

  // Create team member
  const teamMember = await createTestTeamMember(
    user.id,
    team.id,
    userRole,
    additionalData.teamMember
  );

  return {
    user,
    workspace,
    team,
    teamMember,
  };
}

/**
 * Create spaces for testing
 */
export async function createTestSpaces(
  teamId: string,
  workspaceId: string,
  count: number = 3,
  baseProperties: Partial<any> = {}
): Promise<any[]> {
  const spaces = [];

  for (let i = 0; i < count; i++) {
    const space = await createTestSpace(teamId, workspaceId, {
      name: `Test Space ${i + 1}`,
      slug: `test-space-${i + 1}`,
      ...baseProperties,
    });
    spaces.push(space);
  }

  return spaces;
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a response has the expected structure
 */
export function expectApiResponse(response: any, expectedSuccess: boolean = true) {
  expect(response).toHaveProperty('success', expectedSuccess);

  if (expectedSuccess) {
    expect(response).toHaveProperty('data');
  } else {
    expect(response).toHaveProperty('error');
  }
}

/**
 * Assert that a space response has the required fields
 */
export function expectSpaceResponse(space: any) {
  expect(space).toHaveProperty('id');
  expect(space).toHaveProperty('name');
  expect(space).toHaveProperty('slug');
  expect(space).toHaveProperty('teamId');
  expect(space).toHaveProperty('workspaceId');
  expect(space).toHaveProperty('visibility');
  expect(space).toHaveProperty('createdAt');
  expect(space).toHaveProperty('updatedAt');
}

/**
 * Assert that a team response has the required fields
 */
export function expectTeamResponse(team: any) {
  expect(team).toHaveProperty('id');
  expect(team).toHaveProperty('name');
  expect(team).toHaveProperty('slug');
  expect(team).toHaveProperty('workspaceId');
  expect(team).toHaveProperty('createdAt');
  expect(team).toHaveProperty('updatedAt');
}

// ============================================================================
// PERFORMANCE AND TIMING HELPERS
// ============================================================================

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTime: number }> {
  const startTime = Date.now();
  const result = await fn();
  const executionTime = Date.now() - startTime;

  return { result, executionTime };
}

/**
 * Assert that a function executes within the time limit
 */
export async function expectExecutionUnderLimit<T>(
  fn: () => Promise<T>,
  timeLimitMs: number
): Promise<T> {
  const { result, executionTime } = await measureExecutionTime(fn);

  expect(executionTime).toBeLessThan(timeLimitMs);
  return result;
}

// ============================================================================
// DATABASE VERIFICATION HELPERS
// ============================================================================

/**
 * Verify that a record exists in the database
 */
export async function expectRecordExists(
  model: keyof typeof prisma,
  where: any
): Promise<any> {
  const record = await (prisma as any)[model].findUnique({ where });
  expect(record).not.toBeNull();
  return record;
}

/**
 * Verify that a record does not exist in the database
 */
export async function expectRecordNotExists(
  model: keyof typeof prisma,
  where: any
): Promise<void> {
  const record = await (prisma as any)[model].findUnique({ where });
  expect(record).toBeNull();
}

/**
 * Count records in a table matching the criteria
 */
export async function countRecords(
  model: keyof typeof prisma,
  where: any = {}
): Promise<number> {
  return await (prisma as any)[model].count({ where });
}

// ============================================================================
// ERROR HANDLING HELPERS
// ============================================================================

/**
 * Extract error message from API response
 */
export function extractErrorMessage(response: any): string {
  if (typeof response === 'string') {
    try {
      const parsed = JSON.parse(response);
      return parsed.error || parsed.message || 'Unknown error';
    } catch {
      return response;
    }
  }

  return response?.error || response?.message || 'Unknown error';
}

/**
 * Expect an API response to contain a specific error
 */
export function expectApiError(response: any, expectedError: string | RegExp): void {
  const errorMessage = extractErrorMessage(response);

  if (typeof expectedError === 'string') {
    expect(errorMessage).toContain(expectedError);
  } else {
    expect(errorMessage).toMatch(expectedError);
  }
}