/*
 * Teams Spaces API TDD Test Suite - CORE Teams MVP
 *
 * COMPREHENSIVE TEST-DRIVEN DEVELOPMENT SUITE FOR POST /api/v1/teams/:teamId/spaces
 *
 * These tests define HOW the Spaces API MUST behave before fixing any implementation.
 * They follow strict TDD principles: Tests First, Requirements Definition, Edge Cases Coverage.
 *
 * CRITICAL: These tests WILL FAIL on the current implementation, exposing bugs that need fixing.
 *
 * PRINCIPLES:
 * 1. Business language over technical implementation
 * 2. Security-first testing (non-members should NEVER create spaces)
 * 3. Real-world scenarios that actually happen in production
 * 4. Invariant testing (rules that should NEVER be broken)
 * 5. Edge case and error handling
 * 6. Response format validation
 */

// Mock supertest request/response for simpler testing
const mockRequest = (body: any, headers: Record<string, string> = {}) => ({
  json: async () => body,
  text: async () => JSON.stringify(body),
  headers: new Headers(headers),
  signal: new AbortController().signal,
  method: 'POST',
  url: 'http://localhost:3000/api/v1/teams/test-team/spaces',
});

const mockResponse = () => {
  const headers = new Headers();
  return {
    headers,
    status: 200,
    ok: true,
    json: jest.fn().mockResolvedValue({ success: true }),
    text: jest.fn().mockResolvedValue('{"success":true}'),
  };
};

// Import express for testing
import express from 'express';

// Import dependencies after mocks
import { mockPrisma } from '../../__mocks__/database';
import { permissionService } from '../../app/services/permission.server';
import { checkRateLimit } from '../../app/utils/rate-limit.server';
import { AuditService } from '../../app/services/audit.service';
import request from 'supertest';

// Mock all dependencies
jest.mock('../../app/db.server', () => {
  const { mockPrisma } = require('../../__mocks__/database');
  return {
    prisma: mockPrisma,
  };
});

jest.mock('../../app/services/permission.server');
jest.mock('../../app/utils/rate-limit.server');
jest.mock('../../app/services/audit.service');

// Mock the logger
jest.mock('../../app/services/logger.service', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import route handler after mocks
const spacesRouteModule = require('../../app/routes/api.v1.teams.$teamId.spaces');

// Type cast mocked services for proper type checking
const mockedPermissionService = permissionService as jest.Mocked<typeof permissionService>;
const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockedAuditService = AuditService as jest.Mocked<typeof AuditService>;

// ============================================================================
// MOCK DATA FACTORIES - Realistic Test Data
// ============================================================================

interface MockUser {
  id: string;
  email: string;
  name: string;
}

interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  userId: string;
}

interface MockTeam {
  id: string;
  name: string;
  slug: string;
  workspaceId: string;
}

interface MockTeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

interface MockSpace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'PRIVATE' | 'TEAM' | 'WORKSPACE';
  icon?: string;
  autoMode?: boolean;
  themes?: string[];
  workspaceId: string;
  teamId?: string;
  createdAt: Date;
  updatedAt: Date;
}

class TestDataFactory {
  static createUser(overrides: Partial<MockUser> = {}): MockUser {
    return {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
      name: 'Test User',
      ...overrides,
    };
  }

  static createWorkspace(overrides: Partial<MockWorkspace> = {}): MockWorkspace {
    return {
      id: `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Acme Workspace',
      slug: 'acme-workspace',
      userId: `user_${Date.now()}`,
      ...overrides,
    };
  }

  static createTeam(overrides: Partial<MockTeam> = {}): MockTeam {
    return {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Engineering Team',
      slug: 'engineering',
      workspaceId: `workspace_${Date.now()}`,
      ...overrides,
    };
  }

  static createTeamMember(overrides: Partial<MockTeamMember> = {}): MockTeamMember {
    return {
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teamId: `team_${Date.now()}`,
      userId: `user_${Date.now()}`,
      role: 'MEMBER',
      ...overrides,
    };
  }

  static createSpace(overrides: Partial<MockSpace> = {}): MockSpace {
    const now = new Date();
    return {
      id: `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Test Space',
      slug: 'test-space',
      description: undefined,
      visibility: 'TEAM',
      icon: '📁',
      autoMode: false,
      themes: [],
      workspaceId: `workspace_${Date.now()}`,
      teamId: `team_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  static createAuthToken(userId: string): string {
    return `Bearer rc_pat_${Math.random().toString(36).substr(2, 32)}`;
  }
}

// ============================================================================
// SETUP AND TEARDOWN
// ============================================================================

describe('POST /api/v1/teams/:teamId/spaces - Teams Spaces API TDD Suite', () => {
  let mockApp: any;
  let testUser: MockUser;
  let testWorkspace: MockWorkspace;
  let testTeam: MockTeam;

  beforeAll(() => {
    // Create minimal Express app for testing
    mockApp = express();
    mockApp.use(express.json());

    // Mock authentication middleware
    mockApp.use((req: any, res, next) => {
      req.authentication = {
        userId: testUser?.id || 'test_user',
        type: 'pat',
      };
      next();
    });

    // Add the route
    mockApp.post('/api/v1/teams/:teamId/spaces', spacesRouteModule.action);
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default test data
    testUser = TestDataFactory.createUser();
    testWorkspace = TestDataFactory.createWorkspace({ userId: testUser.id });
    testTeam = TestDataFactory.createTeam({ workspaceId: testWorkspace.id });

    // Setup default rate limit mock
    mockedCheckRateLimit.mockResolvedValue();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // SUCCESS SCENARIOS - Happy Path Testing
  // ============================================================================

  describe('When authenticated user creates team space with valid data', () => {
    it('should create team space with minimal valid data', async () => {
      // Given: Team owner wants to create a space
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'API Architecture',
      };

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        slug: 'api-architecture',
        description: undefined,
        visibility: 'TEAM',
        icon: '📁',
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      // Mock dependencies
      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Creating the space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should succeed with proper response
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        space: {
          id: expectedSpace.id,
          name: expectedSpace.name,
          slug: expectedSpace.slug,
          description: expectedSpace.description,
          visibility: expectedSpace.visibility,
          icon: expectedSpace.icon,
          autoMode: expectedSpace.autoMode,
          themes: expectedSpace.themes,
          teamId: expectedSpace.teamId,
          workspaceId: expectedSpace.workspaceId,
          createdAt: expectedSpace.createdAt.toISOString(),
          updatedAt: expectedSpace.updatedAt.toISOString(),
        },
        success: true,
      });

      // And: Should have called dependencies correctly
      expect(mockedPermissionService.requireTeamAdmin).toHaveBeenCalledWith(
        testUser.id,
        testTeam.id
      );
      expect(mockPrisma.space.create).toHaveBeenCalledWith({
        data: {
          name: spaceData.name,
          slug: 'api-architecture',
          description: undefined,
          visibility: 'TEAM',
          icon: '📁',
          autoMode: false,
          themes: [],
          teamId: testTeam.id,
          workspaceId: testWorkspace.id,
        },
      });
      expect(mockedAuditService.logSpaceCreate).toHaveBeenCalled();
    });

    it('should create team space with complete valid data', async () => {
      // Given: Team admin creates space with all fields
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'ADMIN',
      });

      const spaceData = {
        name: 'Database Documentation',
        description: 'All database schemas and documentation',
        visibility: 'TEAM',
        icon: '🗄️',
      };

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        slug: 'database-documentation',
        description: spaceData.description,
        visibility: spaceData.visibility,
        icon: spaceData.icon,
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Creating the space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should succeed
      expect(response.status).toBe(201);
      expect(response.body.space.name).toBe(spaceData.name);
      expect(response.body.space.description).toBe(spaceData.description);
      expect(response.body.space.visibility).toBe(spaceData.visibility);
      expect(response.body.space.icon).toBe(spaceData.icon);
    });

    it('should generate unique slug from space name', async () => {
      // Given: Creating space with name that needs slugification
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'API Design & Architecture 2024!',
      };

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        slug: 'api-design-architecture-2024',
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Creating the space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should generate proper slug
      expect(response.status).toBe(201);
      expect(mockPrisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: spaceData.name,
            slug: 'api-design-architecture-2024',
          }),
        })
      );
    });

    it('should handle duplicate slug by appending suffix', async () => {
      // Given: Space with slug already exists
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const existingSpace = TestDataFactory.createSpace({
        name: 'Existing Space',
        slug: 'existing-space',
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      const spaceData = {
        name: 'Existing Space',
      };

      const newSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        slug: 'existing-space-2', // Should append suffix
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.findMany.mockResolvedValue([existingSpace]); // Existing space with same slug
      mockPrisma.space.create.mockResolvedValue(newSpace);

      // When: Creating space with duplicate slug
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should handle duplicate slug
      expect(response.status).toBe(201);
      expect(response.body.space.name).toBe(spaceData.name);
      expect(response.body.space.slug).toBe('existing-space-2');
    });
  });

  // ============================================================================
  // PERMISSION VALIDATION - Security Testing
  // ============================================================================

  describe('When user lacks required permissions', () => {
    it('should reject space creation by non-team members', async () => {
      // Given: User is not a team member
      const spaceData = {
        name: 'Unauthorized Space',
      };

      mockedPermissionService.requireTeamAdmin.mockRejectedValue(
        new Error('User is not a team member')
      );

      // When: Non-member tries to create space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should be rejected
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(mockPrisma.space.create).not.toHaveBeenCalled();
    });

    it('should reject space creation by team members without admin permissions', async () => {
      // Given: User is regular team member
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'MEMBER',
      });

      const spaceData = {
        name: 'Member Space',
      };

      mockedPermissionService.requireTeamAdmin.mockRejectedValue(
        new Error('Admin access required')
      );

      // When: Regular member tries to create space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should be rejected
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin access required');
    });

    it('should reject space creation by team viewers', async () => {
      // Given: User is team viewer
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'VIEWER',
      });

      const spaceData = {
        name: 'Viewer Space',
      };

      mockedPermissionService.requireTeamAdmin.mockRejectedValue(
        new Error('Admin access required')
      );

      // When: Viewer tries to create space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should be rejected
      expect(response.status).toBe(403);
    });

    it('should allow space creation by team owners', async () => {
      // Given: User is team owner
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Owner Space',
      };

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Owner creates space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should succeed
      expect(response.status).toBe(201);
      expect(response.body.space.name).toBe(spaceData.name);
    });
  });

  // ============================================================================
  // DATA VALIDATION - Input Validation Testing
  // ============================================================================

  describe('When request data is invalid', () => {
    it('should reject spaces with name shorter than 3 characters', async () => {
      // Given: Invalid name length
      const invalidSpaceData = {
        name: 'AB', // Only 2 characters
      };

      // When: Creating space with short name
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(invalidSpaceData);

      // Then: Should be rejected
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should reject spaces with empty name', async () => {
      // Given: Empty name
      const invalidSpaceData = {
        name: '',
      };

      // When: Creating space with empty name
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(invalidSpaceData);

      // Then: Should be rejected
      expect(response.status).toBe(400);
    });

    it('should reject spaces with name longer than 50 characters', async () => {
      // Given: Name too long
      const invalidSpaceData = {
        name: 'A'.repeat(51), // 51 characters
      };

      // When: Creating space with long name
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(invalidSpaceData);

      // Then: Should be rejected
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should reject spaces with description longer than 500 characters', async () => {
      // Given: Description too long
      const invalidSpaceData = {
        name: 'Valid Name',
        description: 'A'.repeat(501), // 501 characters
      };

      // When: Creating space with long description
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(invalidSpaceData);

      // Then: Should be rejected
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('description');
    });

    it('should reject spaces with invalid visibility', async () => {
      // Given: Invalid visibility value
      const invalidSpaceData = {
        name: 'Valid Name',
        visibility: 'INVALID_VISIBILITY',
      };

      // When: Creating space with invalid visibility
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(invalidSpaceData);

      // Then: Should be rejected
      expect(response.status).toBe(400);
    });

    it('should default visibility to TEAM when not provided', async () => {
      // Given: No visibility provided
      const spaceData = {
        name: 'Default Visibility Space',
      };

      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        visibility: 'TEAM',
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Creating space without visibility
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should default to TEAM visibility
      expect(response.status).toBe(201);
      expect(response.body.space.visibility).toBe('TEAM');
      expect(mockPrisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: 'TEAM',
          }),
        })
      );
    });

    it('should default icon to 📁 when not provided', async () => {
      // Given: No icon provided
      const spaceData = {
        name: 'Default Icon Space',
      };

      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        icon: '📁',
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Creating space without icon
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should default to 📁 icon
      expect(response.status).toBe(201);
      expect(response.body.space.icon).toBe('📁');
    });
  });

  // ============================================================================
  // BUSINESS LOGIC - Domain Rules Testing
  // ============================================================================

  describe('When team does not exist', () => {
    it('should return 404 for non-existent team', async () => {
      // Given: Non-existent team ID
      const nonExistentTeamId = 'team_non_existent';
      const spaceData = {
        name: 'Space for Non-existent Team',
      };

      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: nonExistentTeamId,
        role: 'OWNER',
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue(null); // Team not found

      // When: Creating space for non-existent team
      const response = await request(mockApp)
        .post(`/api/v1/teams/${nonExistentTeamId}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should return 404
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Team not found');
      expect(mockPrisma.space.create).not.toHaveBeenCalled();
    });

    it('should validate teamId parameter format', async () => {
      // Given: Invalid team ID format
      const invalidTeamId = '';
      const spaceData = {
        name: 'Test Space',
      };

      // When: Using invalid team ID
      const response = await request(mockApp)
        .post(`/api/v1/teams/${invalidTeamId}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should be rejected
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('When rate limits are exceeded', () => {
    it('should reject requests when rate limited', async () => {
      // Given: Rate limit exceeded
      mockedCheckRateLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      const spaceData = {
        name: 'Rate Limited Space',
      };

      // When: Making request after rate limit exceeded
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should be rejected
      expect(response.status).toBe(429);
      expect(mockPrisma.space.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ERROR HANDLING - Edge Cases and Failures
  // ============================================================================

  describe('When database errors occur', () => {
    it('should handle database connection errors', async () => {
      // Given: Database error during team lookup
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Database Error Space',
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockRejectedValue(new Error('Database connection failed'));

      // When: Database error occurs
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should handle error gracefully
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to create space');
    });

    it('should handle database errors during space creation', async () => {
      // Given: Database error during space creation
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Creation Error Space',
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockRejectedValue(new Error('Unique constraint violation'));

      // When: Database error occurs during creation
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should handle error gracefully
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Failed to create space');
    });
  });

  describe('When malformed JSON is sent', () => {
    it('should handle malformed JSON requests', async () => {
      // Given: Malformed JSON
      const malformedJson = '{"name": "test", invalid}';

      // When: Sending malformed JSON
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .set('Content-Type', 'application/json')
        .send(malformedJson);

      // Then: Should handle gracefully
      expect([400, 500]).toContain(response.status);
    });

    it('should handle empty request body', async () => {
      // When: Sending empty request
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send({});

      // Then: Should validate missing name
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });
  });

  // ============================================================================
  // AUDIT AND LOGGING - Security and Compliance
  // ============================================================================

  describe('When space is successfully created', () => {
    it('should log audit trail for space creation', async () => {
      // Given: Successful space creation
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Audit Test Space',
        visibility: 'TEAM',
      };

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        visibility: spaceData.visibility,
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      const mockRequest = {
        method: 'POST',
        url: `/api/v1/teams/${testTeam.id}/spaces`,
        headers: new Headers({
          'authorization': TestDataFactory.createAuthToken(testUser.id),
        }),
      };

      // When: Creating space
      await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should log audit trail
      expect(mockedAuditService.logSpaceCreate).toHaveBeenCalledWith({
        userId: testUser.id,
        spaceId: expectedSpace.id,
        teamId: testTeam.id,
        visibility: spaceData.visibility,
        request: expect.any(Object),
      });
    });

    it('should log information message on successful creation', async () => {
      // Given: Successful space creation
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Log Test Space',
      };

      const expectedSpace = TestDataFactory.createSpace({
        name: spaceData.name,
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockResolvedValue(expectedSpace);

      // When: Creating space
      await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should log success message
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Space ${expectedSpace.id} created for team ${testTeam.id} by user ${testUser.id}`)
      );
    });

    it('should log error when space creation fails', async () => {
      // Given: Space creation fails
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Error Space',
      };

      const dbError = new Error('Database constraint violation');

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockRejectedValue(dbError);

      // When: Space creation fails
      await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should log error
      expect(logger.error).toHaveBeenCalledWith(
        'Error creating space:',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // SYSTEM INVARIANTS - Rules That Must Never Be Broken
  // ============================================================================

  describe('System invariants - security rules that must never be broken', () => {
    it('NEVER allow space creation without authentication', async () => {
      // Given: No authentication token
      const spaceData = {
        name: 'No Auth Space',
      };

      // When: Unauthenticated request
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .send(spaceData);

      // Then: Should be rejected
      expect([401, 403]).toContain(response.status);
      expect(mockPrisma.space.create).not.toHaveBeenCalled();
    });

    it('NEVER allow space creation without team association', async () => {
      // Given: Valid request but no teamId
      const spaceData = {
        name: 'No Team Space',
      };

      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });

      // Note: This would be handled by route parameter validation
      // When/Then: Team must always be associated with space
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      expect(response.status).toBe(201);
      expect(response.body.space.teamId).toBe(testTeam.id);
    });

    it('NEVER expose sensitive information in error messages', async () => {
      // Given: Database error with sensitive info
      const teamMember = TestDataFactory.createTeamMember({
        userId: testUser.id,
        teamId: testTeam.id,
        role: 'OWNER',
      });

      const spaceData = {
        name: 'Security Test Space',
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace,
      });
      mockPrisma.space.create.mockRejectedValue(new Error('Database password: secret123'));

      // When: Database error with sensitive info
      const response = await request(mockApp)
        .post(`/api/v1/teams/${testTeam.id}/spaces`)
        .set('Authorization', TestDataFactory.createAuthToken(testUser.id))
        .send(spaceData);

      // Then: Should not expose sensitive info
      expect(response.status).toBe(500);
      expect(response.body.error).not.toContain('secret123');
      expect(response.body.error).toBe('Failed to create space');
    });
  });
});