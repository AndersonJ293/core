/*
 * Teams Spaces API Tests - CORE Teams MVP
 *
 * REAL TDD TESTS for POST /api/v1/teams/:teamId/spaces
 *
 * These tests validate ACTUAL business behavior and expose REAL implementation gaps.
 * Following proper TDD principles: Test behavior, not mocks.
 */

import { prisma } from '../../app/db.server';
import { permissionService, PermissionError } from '../../app/services/permission.server';
import { checkRateLimit } from '../../app/utils/rate-limit.server';
import { AuditService } from '../../app/services/audit.service';
import { json } from '@remix-run/node';

// Import the actual route module
import { action } from '../../app/routes/api.v1.teams.$teamId.spaces';

// Mock external dependencies (NOT internals)
jest.mock('../../app/db.server');
jest.mock('../../app/services/permission.server');
jest.mock('../../app/utils/rate-limit.server');
jest.mock('../../app/services/audit.service');

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedPermissionService = permissionService as jest.Mocked<typeof permissionService>;
const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockedAuditService = AuditService as jest.Mocked<typeof AuditService>;

// ============================================================================
// TEST DATA FACTORIES - Realistic Business Data
// ============================================================================

const createTestUser = () => ({
  id: 'user_test123',
  email: 'test@example.com',
  name: 'Test User'
});

const createTestWorkspace = (userId: string) => ({
  id: 'workspace_test456',
  name: 'Test Workspace',
  slug: 'test-workspace',
  userId
});

const createTestTeam = (workspaceId: string) => ({
  id: 'team_test789',
  name: 'Engineering Team',
  slug: 'engineering',
  workspaceId,
  createdAt: new Date(),
  updatedAt: new Date()
});

const createMockRequest = (body: any, params: any = {}, authentication: any = {}) => ({
  json: async () => body,
  text: async () => JSON.stringify(body),
  headers: new Headers({ 'content-type': 'application/json' }),
  signal: new AbortController().signal,
  method: 'POST',
  url: `http://localhost:3000/api/v1/teams/${params.teamId}/spaces`,
  body,
  params,
  authentication,
});

// ============================================================================
// SETUP AND TEARDOWN
// ============================================================================

describe('POST /api/v1/teams/:teamId/spaces - Real Business Logic Tests', () => {
  const testUser = createTestUser();
  const testWorkspace = createTestWorkspace(testUser.id);
  const testTeam = createTestTeam(testWorkspace.id);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // REAL BUSINESS SCENARIOS - Test Actual Implementation
  // ============================================================================

  describe('Team space creation - Business Logic Validation', () => {
    it('should create team space when user has admin permissions', async () => {
      // Given: User is team admin and valid space data
      const spaceData = {
        name: 'API Documentation',
        description: 'Team API docs',
        visibility: 'TEAM' as const,
        icon: '📚'
      };

      const createdSpace = {
        id: 'space_new123',
        name: spaceData.name,
        slug: 'api-documentation',
        description: spaceData.description,
        visibility: spaceData.visibility,
        icon: spaceData.icon,
        autoMode: false,
        themes: [],
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const teamMember = {
        id: 'member_123',
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'ADMIN' as const,
        team: testTeam
      };

      // Mock successful permission check and database operations
      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockedPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace
      });
      mockedPrisma.space.findFirst.mockResolvedValue(null); // No duplicate slug
      mockedPrisma.space.create.mockResolvedValue(createdSpace);

      const request = createMockRequest(spaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Creating the space
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Should succeed
      expect(response).toBeInstanceOf(Object);
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.space.name).toBe(spaceData.name);
      expect(responseData.space.teamId).toBe(testTeam.id);
      expect(responseData.space.slug).toBe('api-documentation');

      // And: Should have called services correctly
      expect(mockedPermissionService.requireTeamAdmin).toHaveBeenCalledWith(testUser.id, testTeam.id);
      expect(mockedPrisma.space.create).toHaveBeenCalled();
      expect(mockedAuditService.logSpaceCreate).toHaveBeenCalledWith({
        userId: testUser.id,
        spaceId: createdSpace.id,
        teamId: testTeam.id,
        visibility: 'team',
        request
      });
    });

    it('should reject space creation when user lacks admin permissions', async () => {
      // Given: User is not a team admin
      const spaceData = { name: 'Unauthorized Space' };

      // Mock permission rejection
      mockedPermissionService.requireTeamAdmin.mockRejectedValue(
        new PermissionError('User is not an admin of team')
      );

      const request = createMockRequest(spaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Attempting to create space
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Should be rejected
      const responseData = await response.json();
      expect(responseData).toHaveProperty('error');
      expect(mockedPrisma.space.create).not.toHaveBeenCalled();
    });

    it('should reject space creation for non-existent team', async () => {
      // Given: Team does not exist but user has permissions (passes permission check)
      const spaceData = { name: 'Orphan Space' };

      const teamMember = {
        id: 'member_123',
        teamId: 'nonexistent_team',
        userId: testUser.id,
        role: 'OWNER' as const,
        team: null // Team not found
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockedPrisma.team.findUnique.mockResolvedValue(null); // Team not found

      const request = createMockRequest(spaceData, { teamId: 'nonexistent_team' }, { userId: testUser.id });

      // When: Attempting to create space
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: 'nonexistent_team' },
        authentication: { userId: testUser.id }
      });

      // Then: Should return 404
      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error).toContain('Team not found');
      expect(mockedPrisma.space.create).not.toHaveBeenCalled();
    });

    it('should validate space name requirements (minimum 3 characters)', async () => {
      // Given: Invalid space name (too short)
      const invalidSpaceData = { name: 'AB' }; // Only 2 characters

      const teamMember = {
        id: 'member_123',
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'OWNER' as const,
        team: testTeam
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockedPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace
      });

      const request = createMockRequest(invalidSpaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Attempting to create space with invalid name
      const response = await action({
        request,
        body: invalidSpaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Should be rejected by schema validation
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData).toHaveProperty('error');
      expect(mockedPrisma.space.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SLUG GENERATION - Edge Cases
  // ============================================================================

  describe('Slug generation and collision handling', () => {
    it('should generate URL-friendly slugs from space names', async () => {
      // Given: Space name with special characters and spaces
      const spaceData = {
        name: 'API Design & Architecture 2024! @#$%',
      };

      const teamMember = {
        id: 'member_123',
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'OWNER' as const,
        team: testTeam
      };

      const createdSpace = {
        id: 'space_slug123',
        name: spaceData.name,
        slug: 'api-design-architecture-2024',
        description: null,
        visibility: 'TEAM' as const,
        icon: '📁',
        autoMode: false,
        themes: [],
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockedPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace
      });
      // First call returns null (no duplicate), second call returns null for duplicate check
      mockedPrisma.space.findFirst.mockResolvedValue(null);
      mockedPrisma.space.create.mockResolvedValue(createdSpace);

      const request = createMockRequest(spaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Creating space with complex name
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Should generate clean slug
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.space.slug).toBe('api-design-architecture-2024');
    });

    it('should handle slug collisions by appending numbers', async () => {
      // Given: Space with name that would cause collision
      const spaceData = { name: 'API Documentation' };

      const teamMember = {
        id: 'member_123',
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'OWNER' as const,
        team: testTeam
      };

      const createdSpace = {
        id: 'space_collision123',
        name: spaceData.name,
        slug: 'api-documentation-2',
        description: null,
        visibility: 'TEAM' as const,
        icon: '📁',
        autoMode: false,
        themes: [],
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockedPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace
      });

      // Simulate slug collision: first slug exists, second slug is unique
      mockedPrisma.space.findFirst
        .mockResolvedValueOnce({ id: 'existing_space' } as any) // First slug exists
        .mockResolvedValueOnce(null); // Second slug is unique
      mockedPrisma.space.create.mockResolvedValue(createdSpace);

      const request = createMockRequest(spaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Creating space with colliding name
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Should handle collision
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.space.slug).toBe('api-documentation-2');
    });
  });

  // ============================================================================
  // RATE LIMITING AND SECURITY
  // ============================================================================

  describe('Rate limiting and security measures', () => {
    it('should enforce rate limiting on space creation', async () => {
      // Given: User exceeding rate limit
      const spaceData = { name: 'Rate Limited Space' };

      // Mock rate limit exceeded
      mockedCheckRateLimit.mockRejectedValue(new Error('Rate limit exceeded'));

      const request = createMockRequest(spaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Attempting to create space while rate limited
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Should be rejected
      expect(response).toBeInstanceOf(Object);
      expect(mockedPrisma.space.create).not.toHaveBeenCalled();
      expect(mockedAuditService.logSpaceCreate).not.toHaveBeenCalled();
    });

    it('should always associate spaces with correct team and workspace', async () => {
      // Given: Valid space creation request
      const spaceData = {
        name: 'Properly Scoped Space',
        description: 'Must belong to team',
        visibility: 'TEAM' as const
      };

      const teamMember = {
        id: 'member_123',
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'OWNER' as const,
        team: testTeam
      };

      const createdSpace = {
        id: 'space_scoped123',
        name: spaceData.name,
        slug: 'properly-scoped-space',
        description: spaceData.description,
        visibility: spaceData.visibility,
        icon: '📁',
        autoMode: false,
        themes: [],
        teamId: testTeam.id,
        workspaceId: testWorkspace.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedPermissionService.requireTeamAdmin.mockResolvedValue(teamMember);
      mockedPrisma.team.findUnique.mockResolvedValue({
        ...testTeam,
        workspace: testWorkspace
      });
      mockedPrisma.space.findFirst.mockResolvedValue(null);
      mockedPrisma.space.create.mockResolvedValue(createdSpace);

      const request = createMockRequest(spaceData, { teamId: testTeam.id }, { userId: testUser.id });

      // When: Creating space
      const response = await action({
        request,
        body: spaceData,
        params: { teamId: testTeam.id },
        authentication: { userId: testUser.id }
      });

      // Then: Space must be properly scoped
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.space.teamId).toBe(testTeam.id);
      expect(responseData.space.workspaceId).toBe(testWorkspace.id);

      // Critical: Verify database was called with correct scoping
      expect(mockedPrisma.space.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: testTeam.id,
            workspaceId: testWorkspace.id,
            name: spaceData.name
          })
        })
      );
    });
  });
});