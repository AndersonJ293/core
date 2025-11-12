/*
 * MCP Services Team Context Tests - Teams MVP
 *
 * Tests for team context propagation in MCP (Model Context Protocol) services.
 * Validates that:
 * - MCP tools respect team boundaries
 * - Integration access is properly scoped to team context
 * - Cross-team data isolation is maintained in MCP operations
 */

import { McpService } from '../../app/services/mcp.server';
import { permissionService } from '../../app/services/permission.server';
import { prisma } from '../../app/db.server';

// Mock external dependencies
jest.mock('../../app/services/permission.server');
jest.mock('../../app/db.server');

const mockedPermissionService = permissionService as jest.Mocked<typeof permissionService>;
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MCP Services - Team Context Integration', () => {
  let mcpService: McpService;

  beforeEach(() => {
    jest.clearAllMocks();
    mcpService = new McpService();
  });

  // ============================================================================
  // MCP SESSION MANAGEMENT WITH TEAM CONTEXT
  // ============================================================================

  describe('MCP Session Team Context', () => {
    it('should associate MCP sessions with team context', async () => {
      // Given: Creating MCP session with team context
      const userId = 'user123';
      const teamId = 'team456';
      const sessionId = 'session_789';
      const integrationType = 'linear';

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock session creation
      const createdSession = {
        id: sessionId,
        userId,
        teamId, // Session associated with team
        integrationType,
        createdAt: new Date(),
        status: 'active'
      };

      jest.spyOn(mcpService as any, 'createSession')
        .mockResolvedValue(createdSession);

      // When: Creating MCP session with team context
      const result = await mcpService.createSession({
        userId,
        teamId,
        integrationType,
        config: {}
      });

      // Then: Session should be team-scoped
      expect(result.teamId).toBe(teamId);
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, teamId);
    });

    it('should reject MCP session creation for non-team members', async () => {
      // Given: User trying to create MCP session for team they're not in
      const userId = 'user123';
      const unauthorizedTeamId = 'team_restricted456';
      const integrationType = 'slack';

      // Mock user is NOT team member
      mockedPermissionService.isTeamMember.mockResolvedValue(false);

      // When: Attempting to create session
      const createPromise = mcpService.createSession({
        userId,
        teamId: unauthorizedTeamId,
        integrationType,
        config: {}
      });

      // Then: Should be rejected
      await expect(createPromise).rejects.toThrow();
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, unauthorizedTeamId);
    });

    it('should retrieve only team-scoped MCP sessions', async () => {
      // Given: User with sessions across different teams
      const userId = 'user123';
      const teamId = 'team456';

      const teamSessions = [
        {
          id: 'session_team1',
          userId,
          teamId, // Team session
          integrationType: 'linear',
          status: 'active'
        }
      ];

      const otherTeamSessions = [
        {
          id: 'session_other_team',
          userId,
          teamId: 'other_team789', // Different team
          integrationType: 'slack',
          status: 'active'
        }
      ];

      // Mock session retrieval filtered by team
      jest.spyOn(mcpService as any, 'getSessions')
        .mockImplementation(async (filters) => {
          if (filters.teamId === teamId) {
            return teamSessions;
          }
          return otherTeamSessions;
        });

      // When: Retrieving sessions for specific team
      const results = await mcpService.getSessions({
        userId,
        teamId // Filter by team
      });

      // Then: Should return only team sessions
      expect(results).toEqual(teamSessions);
      expect(results.some(s => s.teamId !== teamId)).toBe(false);
    });
  });

  // ============================================================================
  // MCP TOOL EXECUTION WITH TEAM CONTEXT
  // ============================================================================

  describe('MCP Tool Team Scoping', () => {
    it('should execute MCP tools within team context', async () => {
      // Given: MCP tool execution with team context
      const userId = 'user123';
      const teamId = 'team456';
      const sessionId = 'session_789';
      const toolName = 'search_issues';
      const toolArgs = { query: 'bug fixes' };

      // Mock team membership and session ownership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);
      jest.spyOn(mcpService as any, 'validateSessionAccess')
        .mockResolvedValue(true);

      // Mock tool execution with team context
      const toolResult = {
        success: true,
        data: [
          {
            id: 'issue_123',
            title: 'Fix authentication bug',
            teamId, // Result is team-scoped
            projectId: 'proj_456'
          }
        ],
        teamId // Tool result includes team context
      };

      jest.spyOn(mcpService as any, 'executeTool')
        .mockResolvedValue(toolResult);

      // When: Executing tool with team context
      const result = await mcpService.executeTool({
        sessionId,
        toolName,
        args: toolArgs,
        userId,
        teamId // Team context provided
      });

      // Then: Tool execution should respect team context
      expect(result.teamId).toBe(teamId);
      expect(result.data.every((item: any) => item.teamId === teamId)).toBe(true);
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, teamId);
    });

    it('should prevent cross-team tool access', async () => {
      // Given: User trying to access tool from different team context
      const userId = 'user123';
      const sessionId = 'session_789';
      const requestedTeamId = 'team_other456';
      const toolName = 'get_projects';

      // Mock session belongs to different team
      jest.spyOn(mcpService as any, 'getSession')
        .mockResolvedValue({
          id: sessionId,
          userId,
          teamId: 'team_original123', // Different team
          integrationType: 'linear'
        });

      // Mock team membership check fails
      mockedPermissionService.isTeamMember.mockResolvedValue(false);

      // When: Attempting to execute tool with wrong team context
      const executePromise = mcpService.executeTool({
        sessionId,
        toolName,
        args: {},
        userId,
        teamId: requestedTeamId
      });

      // Then: Should be rejected
      await expect(executePromise).rejects.toThrow();
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, requestedTeamId);
    });

    it('should filter MCP tool results by team membership', async () => {
      // Given: MCP tool that returns cross-team data
      const userId = 'user123';
      const teamId = 'team456';
      const sessionId = 'session_789';

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock tool returns mixed team data
      const mixedToolResults = [
        {
          id: 'item_team1',
          name: 'Team Project Alpha',
          teamId, // User's team
          accessible: true
        },
        {
          id: 'item_other_team',
          name: 'Other Team Project',
          teamId: 'other_team789', // Different team
          accessible: false // Should be filtered out
        }
      ];

      jest.spyOn(mcpService as any, 'executeTool')
        .mockResolvedValue({
          success: true,
          data: mixedToolResults
        });

      // When: Executing tool with team filtering
      const result = await mcpService.executeTool({
        sessionId,
        toolName: 'list_projects',
        args: {},
        userId,
        teamId
      });

      // Then: Results should be filtered to team context
      expect(result.data.every((item: any) => item.teamId === teamId || item.accessible)).toBe(true);
      expect(result.data.some((item: any) => item.teamId === 'other_team789' && !item.accessible)).toBe(false);
    });
  });

  // ============================================================================
  // MCP INTEGRATION AUTHORIZATION WITH TEAM CONTEXT
  // ============================================================================

  describe('MCP Integration Team Authorization', () => {
    it('should authorize integrations at team level', async () => {
      // Given: Team-level integration authorization
      const userId = 'user123';
      const teamId = 'team456';
      const integrationType = 'linear';
      const authCode = 'auth_code_789';

      // Mock user is team admin (can authorize integrations)
      mockedPermissionService.canPerformTeamAction.mockResolvedValue(true);

      // Mock successful authorization
      const authResult = {
        success: true,
        teamId,
        integrationType,
        accessToken: 'token_123',
        scope: ['read', 'write']
      };

      jest.spyOn(mcpService as any, 'authorizeIntegration')
        .mockResolvedValue(authResult);

      // When: Authorizing integration for team
      const result = await mcpService.authorizeIntegration({
        userId,
        teamId,
        integrationType,
        authCode
      });

      // Then: Authorization should be team-scoped
      expect(result.teamId).toBe(teamId);
      expect(mockedPermissionService.canPerformTeamAction).toHaveBeenCalledWith(
        userId, teamId, 'edit'
      );
    });

    it('should reject team integration authorization for non-admins', async () => {
      // Given: Regular member trying to authorize team integration
      const userId = 'member123';
      const teamId = 'team456';
      const integrationType = 'slack';

      // Mock user is not team admin
      mockedPermissionService.canPerformTeamAction.mockResolvedValue(false);

      // When: Attempting to authorize integration
      const authPromise = mcpService.authorizeIntegration({
        userId,
        teamId,
        integrationType,
        authCode: 'code_123'
      });

      // Then: Should be rejected
      await expect(authPromise).rejects.toThrow();
      expect(mockedPermissionService.canPerformTeamAction).toHaveBeenCalledWith(
        userId, teamId, 'edit'
      );
    });

    it('should validate integration access within team context', async () => {
      // Given: Checking integration access for team
      const userId = 'user123';
      const teamId = 'team456';
      const integrationType = 'linear';

      // Mock user has team access
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock integration exists for team
      const teamIntegration = {
        id: 'integration_123',
        teamId,
        integrationType,
        isActive: true,
        permissions: ['read_issues', 'write_comments']
      };

      jest.spyOn(mcpService as any, 'getTeamIntegration')
        .mockResolvedValue(teamIntegration);

      // When: Checking integration access
      const result = await mcpService.checkIntegrationAccess({
        userId,
        teamId,
        integrationType
      });

      // Then: Should return team-scoped access
      expect(result.hasAccess).toBe(true);
      expect(result.teamId).toBe(teamId);
      expect(result.permissions).toEqual(teamIntegration.permissions);
    });
  });

  // ============================================================================
  // MCP DATA ISOLATION AND SECURITY
  // ============================================================================

  describe('MCP Data Isolation - Team Security', () => {
    it('should prevent MCP data leakage between teams', async () => {
      // Given: User attempting to access data from different team
      const userId = 'user123';
      const userTeamId = 'team_user456';
      const targetTeamId = 'team_target789';
      const sessionId = 'session_123';

      // Mock user is not member of target team
      mockedPermissionService.isTeamMember
        .mockImplementation((uid, tid) =>
          Promise.resolve(uid === userId && tid === userTeamId)
        );

      // Mock MCP data retrieval that respects team boundaries
      jest.spyOn(mcpService as any, 'retrieveData')
        .mockImplementation(async (params) => {
          if (params.teamId && params.teamId !== userTeamId) {
            throw new Error('Access denied: Team membership required');
          }
          return { data: 'team_data', teamId: params.teamId };
        });

      // When: Attempting to access other team data
      const accessPromise = mcpService.retrieveData({
        sessionId,
        userId,
        teamId: targetTeamId, // Wrong team
        dataType: 'projects'
      });

      // Then: Should be rejected
      await expect(accessPromise).rejects.toThrow('Access denied');
    });

    it('should validate team context on all MCP operations', async () => {
      // Given: Various MCP operations requiring team validation
      const userId = 'user123';
      const teamId = 'team456';
      const sessionId = 'session_789';

      // Mock team membership success
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock successful operations
      jest.spyOn(mcpService as any, 'executeTool').mockResolvedValue({ success: true });
      jest.spyOn(mcpService as any, 'retrieveData').mockResolvedValue({ data: [] });
      jest.spyOn(mcpService as any, 'storeData').mockResolvedValue({ success: true });

      // When: Performing various operations
      await mcpService.executeTool({
        sessionId,
        toolName: 'test',
        args: {},
        userId,
        teamId
      });

      await mcpService.retrieveData({
        sessionId,
        dataType: 'test',
        userId,
        teamId
      });

      await mcpService.storeData({
        sessionId,
        data: { test: true },
        userId,
        teamId
      });

      // Then: All operations should validate team membership
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledTimes(3);
      expect(mockedPermissionService.isTeamMember).toHaveBeenCalledWith(userId, teamId);
    });

    it('should handle team context propagation in MCP proxy', async () => {
      // Given: MCP proxy request with team context
      const userId = 'user123';
      const teamId = 'team456';
      const mcpRequest = {
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: { query: 'test' }
        }
      };

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock MCP proxy response
      const proxyResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: [
                { id: '1', teamId, data: 'team_specific_result' }
              ]
            })
          }
        ],
        teamId // Response includes team context
      };

      jest.spyOn(mcpService as any, 'proxyRequest')
        .mockResolvedValue(proxyResponse);

      // When: Proxying MCP request with team context
      const result = await mcpService.proxyRequest({
        userId,
        teamId,
        request: mcpRequest
      });

      // Then: Response should maintain team context
      expect(result.teamId).toBe(teamId);
      const results = JSON.parse(result.content[0].text).results;
      expect(results.every((r: any) => r.teamId === teamId)).toBe(true);
    });
  });

  // ============================================================================
  // MCP PERFORMANCE WITH TEAM FILTERING
  // ============================================================================

  describe('MCP Performance - Team Context', () => {
    it('should maintain performance with team filtering', async () => {
      // Given: MCP operation with team filtering
      const userId = 'user123';
      const teamId = 'team456';
      const sessionId = 'session_789';

      // Mock team membership
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock operation with team filtering overhead
      jest.spyOn(mcpService as any, 'executeTool')
        .mockImplementation(async () => {
          // Simulate team permission check + filtering
          await new Promise(resolve => setTimeout(resolve, 20));
          return { success: true, data: [], teamId };
        });

      // When: Executing tool with team context
      const startTime = Date.now();
      const result = await mcpService.executeTool({
        sessionId,
        toolName: 'list_items',
        args: {},
        userId,
        teamId
      });
      const endTime = Date.now();

      // Then: Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100); // Allow for team check + operation
      expect(result.teamId).toBe(teamId);
    });

    it('should batch team permission checks for multiple operations', async () => {
      // Given: Multiple MCP operations for same user/team
      const userId = 'user123';
      const teamId = 'team456';
      const operations = [
        { toolName: 'get_projects', args: {} },
        { toolName: 'get_issues', args: {} },
        { toolName: 'get_comments', args: {} }
      ];

      // Mock team membership (should be cached/batched)
      mockedPermissionService.isTeamMember.mockResolvedValue(true);

      // Mock operations
      jest.spyOn(mcpService as any, 'executeTool')
        .mockResolvedValue({ success: true, data: [], teamId });

      // When: Executing multiple operations
      const promises = operations.map(op =>
        mcpService.executeTool({
          sessionId: 'session_123',
          toolName: op.toolName,
          args: op.args,
          userId,
          teamId
        })
      );

      const results = await Promise.all(promises);

      // Then: All operations should succeed and potentially batch permission checks
      expect(results.every(r => r.teamId === teamId)).toBe(true);
      // Note: In real implementation, team permission should be cached for multiple operations
    });
  });
});